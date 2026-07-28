import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import session from "express-session";
import connectPg from "connect-pg-simple";
import createMemoryStore from "memorystore";
import rateLimit from "express-rate-limit";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { loginSchema, createUserSchema } from "@shared/schema";
import type { User, InsertUser } from "@shared/schema";

// Brute-force protection: credential endpoints allow a small burst then back
// off. Keyed per-IP (default). Successful logins don't need more than a few
// attempts; 20 per 15 minutes is generous for humans and hostile to scripts.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in a few minutes." },
});

// Extend Express session to include user
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      isAdmin: boolean;
      adminRole: string; // "none", "basic", or "full"
    };
  }
}

// ---------------------------------------------------------------------------
// Bearer token store — used as a cookie-independent auth fallback.
// The Replit workspace embeds the app preview inside a cross-origin iframe,
// which causes browsers to block session cookies even with SameSite=None.
// Storing an auth token in localStorage and sending it as Authorization:Bearer
// completely bypasses this iframe cookie restriction.
// ---------------------------------------------------------------------------
interface TokenEntry { userId: string; expiresAt: number; }
const authTokens = new Map<string, TokenEntry>();

export function createAuthToken(userId: string): string {
  const token = randomBytes(32).toString('hex');
  authTokens.set(token, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  return token;
}

export function revokeAuthToken(token: string): void {
  authTokens.delete(token);
}

type SessionUser = { id: string; username: string; isAdmin: boolean; adminRole: string };

async function getUserFromBearer(req: any): Promise<SessionUser | null> {
  const auth = (req.headers['authorization'] as string) || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const entry = authTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) { authTokens.delete(token); return null; }
  try {
    const user = await storage.getUser(entry.userId);
    if (!user) return null;
    return { id: user.id, username: user.username, isAdmin: user.isAdmin, adminRole: user.adminRole };
  } catch { return null; }
}

// Returns the authenticated user from session OR bearer token, always fresh from DB.
export async function getCurrentUser(req: any): Promise<SessionUser | null> {
  if (req.session?.user?.id) {
    try {
      const user = await storage.getUser(req.session.user.id);
      if (!user) return null;
      if (req.session.user.adminRole !== user.adminRole || req.session.user.isAdmin !== user.isAdmin) {
        req.session.user.adminRole = user.adminRole;
        req.session.user.isAdmin = user.isAdmin;
        req.session.save(() => {});
      }
      return { id: user.id, username: user.username, isAdmin: user.isAdmin, adminRole: user.adminRole };
    } catch { return null; }
  }
  return getUserFromBearer(req);
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Detect if running in production (Replit deployments or NODE_ENV=production)
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';

  // Detect any Replit environment (dev or prod) — the app preview is always served
  // inside a cross-origin iframe on replit.dev, so sameSite:'lax' causes the browser
  // to silently drop the session cookie on every subsequent request.
  const isReplit = !!process.env.REPL_ID;

  // Always use PostgreSQL when available — persists sessions across server restarts
  let sessionStore;
  if (process.env.DATABASE_URL) {
    console.log('🗄️ Using PostgreSQL session store');
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    console.log('💾 Using memory session store');
    const MemoryStore = createMemoryStore(session);
    sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  // On Replit the preview runs inside a cross-origin iframe (replit.com embeds
  // picard.replit.dev). Browsers block sameSite:'lax' cookies in that context,
  // so we must use sameSite:'none' + secure:true whenever we're on Replit.
  const cookieSameSite: 'none' | 'lax' = isReplit ? 'none' : 'lax';
  const cookieSecure: boolean = isReplit ? true : isProduction;
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  // Session middleware is now set up in server/index.ts as the first middleware
  
  // Registration endpoint
  app.post("/api/auth/register", authRateLimiter, async (req, res) => {
    try {
      const result = createUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid registration data", errors: result.error.errors });
      }

      const { username, password, email, firstName, lastName } = result.data;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Create user
      const user = await createUser({
        username,
        password,
        email,
        firstName,
        lastName,
        isAdmin: false, // Never allow registration as admin
      });

      // Store user in session (auto-login after registration)
      req.session.user = {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        adminRole: user.adminRole,
      };

      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          console.error("❌ Session save error:", err);
          return res.status(500).json({ message: "Could not create session" });
        }

        // Return user without password hash
        const { passwordHash, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", authRateLimiter, async (req, res) => {
    try {
      console.log('🔐 Login attempt for:', req.body?.username);
      
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        console.log('❌ Invalid credentials format:', result.error);
        return res.status(400).json({ message: "Invalid credentials format" });
      }

      const { username, password } = result.data;
      
      console.log('📝 Looking up user:', username);
      let user = await storage.getUserByUsername(username);

      // Also try email if username lookup failed
      if (!user && username.includes('@')) {
        user = await storage.getUserByEmail(username.toLowerCase().trim());
      }

      if (!user) {
        console.log('❌ User not found:', username);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      console.log('🔑 Comparing password for:', username);
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        console.log('❌ Invalid password for:', username);
        return res.status(401).json({ message: "Invalid username or password" });
      }

      console.log('✅ Password valid, creating session for:', username);

      // Create a bearer token — works regardless of whether session cookies are blocked
      // (e.g. inside Replit's cross-origin iframe preview).
      const authToken = createAuthToken(user.id);
      
      // Store user in session
      req.session.user = {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        adminRole: user.adminRole,
      };

      // Save session explicitly
      req.session.save((err) => {
        if (err) console.warn("⚠️ Session save warning:", err?.message);

        console.log('✅ Login complete for:', username);
        
        // Return user without password hash + the bearer token for localStorage storage
        const { passwordHash, ...userWithoutPassword } = user;
        res.json({ ...userWithoutPassword, _authToken: authToken });
      });
    } catch (error) {
      console.error("❌ Login error (FULL):", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Forgot password — generates token and sends reset email
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());

      // Always respond success to prevent user enumeration
      if (!user) {
        return res.json({ message: "If that email is registered, a reset link has been sent." });
      }

      // Generate secure token valid for 1 hour
      const token = randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000);

      await storage.updateUser(user.id, {
        passwordResetToken: token,
        passwordResetExpiry: expiry,
      } as any);

      const resetUrl = `${req.protocol}://${req.get("host")}/reset-password/${token}`;

      try {
        const { sendPasswordResetEmail } = await import("./email.js");
        await sendPasswordResetEmail({
          toEmail: user.email!,
          firstName: user.firstName,
          username: user.username,
          resetUrl,
        });
      } catch (emailErr) {
        console.error("Failed to send password reset email:", emailErr);
      }

      res.json({ message: "If that email is registered, a reset link has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reset password — validates token and sets new password
  app.post("/api/auth/reset-password/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;

      if (!password || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const user = await storage.getUserByResetToken(token);

      if (!user || !user.passwordResetExpiry || new Date() > user.passwordResetExpiry) {
        return res.status(400).json({ message: "This reset link is invalid or has expired." });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await storage.updateUser(user.id, {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      } as any);

      res.json({ message: "Password updated successfully. You can now log in." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Change password (for logged-in users)
  app.post("/api/auth/change-password", async (req, res) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      const user = await storage.getUser(req.session.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Current password is incorrect" });

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { passwordHash } as any);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    // Revoke bearer token if present
    const auth = (req.headers['authorization'] as string) || '';
    if (auth.startsWith('Bearer ')) revokeAuthToken(auth.slice(7));

    req.session.destroy((err) => {
      if (err) console.warn("Logout session destroy warning:", err?.message);
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user endpoint — accepts session cookie OR Authorization: Bearer token
  app.get("/api/auth/user", async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const { passwordHash, ...userWithoutPassword } = await storage.getUser(user.id) as User;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update user preferences (e.g. last-used dashboard tab)
  app.patch("/api/auth/preferences", async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      const { dashboardTab } = req.body;
      const allowed = ["overview", "pipeline", "enquiries"];
      if (dashboardTab !== undefined && !allowed.includes(dashboardTab)) {
        return res.status(400).json({ message: "Invalid dashboardTab value" });
      }

      const updates: Partial<InsertUser> = {};
      if (dashboardTab !== undefined) updates.dashboardTab = dashboardTab;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid preferences provided" });
      }

      await storage.updateUser(user.id, updates);
      res.json({ message: "Preferences updated" });
    } catch (error) {
      console.error("Update preferences error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

// Middleware to check if user is authenticated (session cookie OR Bearer token)
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  next();
};

// Middleware to check if user is admin (full admin only) — always validates against DB
export const isAdmin: RequestHandler = async (req, res, next) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.adminRole !== "full") return res.status(403).json({ message: "Forbidden - Full admin access required" });
  next();
};

// Middleware to check if user has at least basic admin role — always validates against DB
export const isBasicAdmin: RequestHandler = async (req, res, next) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (!["basic", "full"].includes(user.adminRole)) return res.status(403).json({ message: "Forbidden - Admin access required" });
  next();
};

// Middleware to check if user has full admin role (alias of isAdmin)
export const isFullAdmin: RequestHandler = async (req, res, next) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.adminRole !== "full") return res.status(403).json({ message: "Forbidden - Full admin access required" });
  next();
};

// Middleware to check if user has finance partner role
export const isFinanceUser: RequestHandler = async (req, res, next) => {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.adminRole !== "finance") return res.status(403).json({ message: "Forbidden - Finance portal access required" });
  next();
};

// Helper function to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Helper function to create a user with hashed password
export async function createUser(userData: {
  username: string;
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isAdmin?: boolean;
}): Promise<User> {
  const passwordHash = await hashPassword(userData.password);
  
  return storage.createUser({
    username: userData.username,
    passwordHash,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    isAdmin: userData.isAdmin || false,
  });
}
