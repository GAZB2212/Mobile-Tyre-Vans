import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { pool } from "./db";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin, isBasicAdmin, isFullAdmin, isFinanceUser, getCurrentUser } from "./auth";
import { computeQuoteTotals, vanNetPrice, computeFinancePayments, VAT_RATE } from "@shared/pricing";
import { BRAND, siteUrl as brandSiteUrl } from "@shared/brand";
import rateLimit from "express-rate-limit";
import { buildVanMeta } from "./seo";
import { generateAiBlogPost } from "./blogGenerator";
import { computePopularityIntelligence, formatPopularityBlock } from "./popularityIntelligence";
import { chromium } from "playwright";
import { 
  insertVanSchema, 
  insertKitSchema, 
  insertUpgradeSchema, 
  insertQuoteSchema, 
  insertLeadSchema, 
  insertFinancePlanSchema,
  insertTrainingOptionSchema,
  insertGalleryItemSchema,
  insertTestimonialSchema,
  createUserSchema,
  updateUserRoleSchema,
  quoteStatuses,
  financeStatuses,
  buildStages,
  type User,
  type Quote,
  type Van,
  type VanSaleStatus,
  type VanWithSaleStatus,
} from "@shared/schema";
import { deriveHeadlineMachines } from "@shared/kitHeadlineMachines";

// Quote statuses that imply a van has been committed to a customer. A quote at
// "deposit taken" or "finance approved" (ready for build) marks the van as
// deposit taken; once it's actually in the build/workshop pipeline or completed
// the van counts as sold.
const SALE_RANK: Record<VanSaleStatus, number> = { available: 0, deposit_taken: 1, sold: 2 };
const QUOTE_STATUS_TO_SALE: Record<string, VanSaleStatus> = {
  deposit_taken: "deposit_taken",
  finance_approved: "deposit_taken",
  in_build: "sold",
  in_workshop: "sold",
  completed: "sold",
};

function attachSaleStatus(van: Van, quotes: Array<{ vanId: string | null; status: string }>): VanWithSaleStatus {
  let derived: VanSaleStatus = "available";
  for (const q of quotes) {
    if (q.vanId !== van.id) continue;
    const mapped = QUOTE_STATUS_TO_SALE[q.status];
    if (mapped && SALE_RANK[mapped] > SALE_RANK[derived]) derived = mapped;
  }
  const manual = (van.saleStatus ?? "available") as VanSaleStatus;
  const effective = SALE_RANK[manual] >= SALE_RANK[derived] ? manual : derived;
  return { ...van, derivedSaleStatus: derived, effectiveSaleStatus: effective };
}

const SERVER_START_TIME = Date.now().toString();

async function sortUpgradesByDisplayOrder<T extends { category: string; sortOrder: number }>(upgrades: T[]): Promise<T[]> {
  if (upgrades.length === 0) return upgrades;
  const { rows } = await pool.query<{ id: string; sort_order: number }>(
    `SELECT id, sort_order FROM upgrade_categories ORDER BY sort_order ASC, label ASC`
  );
  const catOrder = new Map<string, number>(rows.map(r => [r.id, r.sort_order]));
  return [...upgrades].sort((a, b) => {
    const catA = catOrder.has(a.category) ? catOrder.get(a.category)! : 999;
    const catB = catOrder.has(b.category) ? catOrder.get(b.category)! : 999;
    if (catA !== catB) return catA - catB;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

async function generateNextSku(type: 'kit' | 'upgrade' | 'part'): Promise<string> {
  const prefix = type === 'kit' ? 'MTV-K' : type === 'upgrade' ? 'MTV-U' : 'MTV-P';
  const allNums: number[] = [];

  if (type === 'part') {
    const [kitsResult, upgradesResult] = await Promise.all([
      pool.query(`SELECT sku_components FROM kits WHERE sku_components IS NOT NULL`),
      pool.query(`SELECT sku_components FROM upgrades WHERE sku_components IS NOT NULL`),
    ]);
    for (const row of [...kitsResult.rows, ...upgradesResult.rows]) {
      const components: Array<{ sku?: string }> = row.sku_components || [];
      for (const comp of components) {
        if (comp.sku && comp.sku.startsWith(prefix)) {
          const num = parseInt(comp.sku.slice(prefix.length), 10);
          if (!isNaN(num)) allNums.push(num);
        }
      }
    }
  } else {
    const table = type === 'kit' ? 'kits' : 'upgrades';
    const r = await pool.query(`SELECT sku FROM ${table} WHERE sku LIKE $1`, [`${prefix}%`]);
    for (const row of r.rows) {
      if (row.sku) {
        const num = parseInt((row.sku as string).slice(prefix.length), 10);
        if (!isNaN(num)) allNums.push(num);
      }
    }
  }

  const max = allNums.length > 0 ? Math.max(...allNums) : 0;
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Version endpoint — returns the server startup timestamp so the admin
  // frontend can detect when the server has restarted (new deployment)
  app.get("/api/version", (_req, res) => {
    res.json({ version: SERVER_START_TIME });
  });

  // Storage configuration endpoint - returns bucket name for frontend image URLs
  app.get("/api/storage/config", async (req, res) => {
    try {
      // Extract bucket name from environment variables
      const privateDir = process.env.PRIVATE_OBJECT_DIR || '';
      const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
      
      // Parse bucket name from either variable (format: /bucket-name/path)
      let bucketName = '';
      if (privateDir) {
        const match = privateDir.match(/^\/([^\/]+)\//);
        bucketName = match ? match[1] : '';
      } else if (publicPaths) {
        const match = publicPaths.match(/^\/([^\/]+)\//);
        bucketName = match ? match[1] : '';
      }
      
      res.json({ bucketName });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch storage config" });
    }
  });

  // ── External / webhook endpoints ──────────────────────────────────────────
  // Receives a van build request from this app (triggered when a quote moves to
  // "in_build") or from external stock-management systems.
  app.post("/api/external/van-build-request", async (req, res) => {
    try {
      const apiKey = process.env.VAN_CONFIGURATOR_API_KEY;
      if (!apiKey) {
        console.error("[van-build] VAN_CONFIGURATOR_API_KEY is not set");
        return res.status(500).json({ error: "API key not configured on server" });
      }

      const provided = req.headers["x-api-key"];
      if (!provided || provided !== apiKey) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const bodySchema = z.object({
        vanDescription: z.string().min(1),
        items: z.array(z.object({
          description: z.string().min(1),
          quantity: z.number().int().positive(),
        })),
        customerName: z.string().optional(),
        customerContact: z.string().optional(),
        notes: z.string().optional(),
      });

      const body = bodySchema.parse(req.body);

      console.log(`[van-build] Received build request — van: "${body.vanDescription}", items: ${body.items.length}${body.customerName ? `, customer: ${body.customerName}` : ''}`);

      return res.status(201).json({ ok: true, message: "Build request received" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid payload", details: error.errors });
      }
      console.error("[van-build] Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Avatar upload — any authenticated user can update their own avatar
  app.post("/api/user/avatar", isAuthenticated, async (req, res) => {
    const multer = await import("multer");
    const upload = multer.default({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB
    upload.single("file")(req, res, async (err: any) => {
      if (err) return res.status(400).json({ error: "File upload failed" });
      try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(req.file.mimetype.toLowerCase())) {
          return res.status(400).json({ error: "Only image files are allowed" });
        }
        const userId = (req.session as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();
        const avatarUrl = await objectStorageService.uploadAvatarToPublicStorage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        await storage.updateUser(userId, { profileImageUrl: avatarUrl });
        res.json({ avatarUrl });
      } catch (error) {
        console.error("Error uploading avatar:", error);
        res.status(500).json({ error: "Failed to upload avatar" });
      }
    });
  });

  // User management endpoints (for full admins only)
  app.get("/api/admin/users", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove password hashes from response
      const safeUsers = users.map(user => {
        const { passwordHash, ...safeUser } = user;
        return safeUser;
      });
      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const result = createUserSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid user data", errors: result.error.errors });
      }

      const { username, email, firstName, lastName, adminRole } = result.data;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }

      // Generate a random secure placeholder password (user will set their own)
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      // Generate a set-password token (valid for 24 hours)
      const setPasswordToken = crypto.randomBytes(32).toString('hex');
      const setPasswordExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create user with role and token
      const newUser = await storage.createUser({
        username,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash,
        adminRole: adminRole || "none",
        isAdmin: adminRole === "full",
        profileImageUrl: null,
        passwordResetToken: setPasswordToken,
        passwordResetExpiry: setPasswordExpiry,
      });

      const { passwordHash: _, ...safeUser } = newUser;

      // Send set-password invitation email (non-blocking)
      try {
        const { sendNewUserSetPasswordEmail } = await import('./email.js');
        const setPasswordUrl = `${req.protocol}://${req.get('host')}/reset-password/${setPasswordToken}`;
        await sendNewUserSetPasswordEmail({
          toEmail: email,
          firstName: firstName || null,
          username,
          setPasswordUrl,
        });
      } catch (emailErr) {
        console.error('Failed to send set-password email:', emailErr);
      }

      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id/role", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Prevent users from changing their own role
      if (req.session.user?.id === id) {
        return res.status(403).json({ message: "You cannot change your own admin role" });
      }
      
      const result = updateUserRoleSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid role data", errors: result.error.errors });
      }

      const { adminRole } = result.data;
      
      // Update user role and also update isAdmin flag (only full admins get isAdmin=true)
      const updatedUser = await storage.updateUser(id, { 
        adminRole,
        isAdmin: adminRole === "full"
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { passwordHash, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Prevent users from deleting themselves
      if (req.session.user?.id === id) {
        return res.status(403).json({ message: "You cannot delete your own account" });
      }
      
      const deleted = await storage.deleteUser(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Public vans endpoints
  app.get("/api/vans", async (req, res) => {
    try {
      const filters = {
        make: req.query.make as string,
        year: req.query.year ? parseInt(req.query.year as string) : undefined,
        maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined,
        minPrice: req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined,
        transmission: req.query.transmission as string,
        size: req.query.size as string,
      };
      
      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key as keyof typeof filters] === undefined) {
          delete filters[key as keyof typeof filters];
        }
      });
      
      const [vans, quotes] = await Promise.all([
        storage.getVans(Object.keys(filters).length > 0 ? filters : undefined),
        storage.getVanSaleStatusRows(),
      ]);
      res.json(vans.map((van) => attachSaleStatus(van, quotes)));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vans" });
    }
  });

  app.get("/api/vans/:id", async (req, res) => {
    try {
      const van = await storage.getVan(req.params.id);
      if (!van) {
        return res.status(404).json({ error: "Van not found" });
      }
      const quotes = await storage.getVanSaleStatusRows();
      res.json(attachSaleStatus(van, quotes));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch van" });
    }
  });

  app.get("/api/vans/slug/:slug", async (req, res) => {
    try {
      const van = await storage.getVanBySlug(req.params.slug);
      if (!van) {
        return res.status(404).json({ error: "Van not found" });
      }
      const quotes = await storage.getVanSaleStatusRows();
      res.json(attachSaleStatus(van, quotes));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch van" });
    }
  });

  app.post("/api/vans", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const validatedData = insertVanSchema.parse(req.body);
      const van = await storage.createVan(validatedData);
      res.status(201).json(van);
    } catch (error) {
      res.status(400).json({ error: "Invalid van data" });
    }
  });

  // Kits endpoints - public (published only)
  app.get("/api/kits", async (req, res) => {
    try {
      const allKits = await storage.getKits();
      // Filter to only return published kits for public API
      const publishedKits = allKits.filter(kit => kit.published);
      res.json(publishedKits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kits" });
    }
  });

  app.get("/api/kits/:id", async (req, res) => {
    try {
      const kit = await storage.getKit(req.params.id);
      if (!kit || !kit.published) {
        return res.status(404).json({ error: "Kit not found" });
      }
      res.json(kit);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kit" });
    }
  });

  app.post("/api/kits", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const validatedData = insertKitSchema.parse(req.body);
      const kit = await storage.createKit(validatedData);
      res.status(201).json(kit);
    } catch (error) {
      res.status(400).json({ error: "Invalid kit data" });
    }
  });

  // Upgrades endpoints
  app.get("/api/upgrades", async (req, res) => {
    try {
      const category = req.query.category as string;
      const upgrades = await storage.getUpgrades(category);
      res.json(upgrades);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch upgrades" });
    }
  });

  app.get("/api/upgrades/:id", async (req, res) => {
    try {
      const upgrade = await storage.getUpgrade(req.params.id);
      if (!upgrade) {
        return res.status(404).json({ error: "Upgrade not found" });
      }
      res.json(upgrade);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch upgrade" });
    }
  });

  app.post("/api/upgrades", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const validatedData = insertUpgradeSchema.parse(req.body);
      const upgrade = await storage.createUpgrade(validatedData);
      res.status(201).json(upgrade);
    } catch (error) {
      res.status(400).json({ error: "Invalid upgrade data" });
    }
  });

  // Quotes endpoints
  // Public endpoint for completed builds showcase (must come before :id route)
  app.get("/api/quotes/completed", async (req, res) => {
    try {
      const completedQuotes = await storage.getCompletedPortfolioQuotes();
      res.json(completedQuotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch completed builds" });
    }
  });

  // Build-progress endpoints — require authentication (workshop staff must be logged in)
  app.get("/api/build-progress/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Not found" });
      const kit = quote.kitId ? await storage.getKit(quote.kitId) : null;
      const van = quote.vanId ? await storage.getVan(quote.vanId) : null;
      const upgrades = await storage.getAllUpgradesAdmin();
      const selectedUpgrades = await sortUpgradesByDisplayOrder(
        upgrades.filter(u => Array.isArray(quote.selectedUpgradeIds) && quote.selectedUpgradeIds.includes(u.id))
      );
      res.json({
        id: quote.id,
        userName: quote.userName,
        company: quote.company ?? null,
        vanRegistration: quote.vanRegistration ?? van?.reg ?? quote.customVanDescription ?? null,
        status: quote.status,
        customBuildStages: (quote as any).customBuildStages ?? null,
        completedBuildStages: (quote as any).completedBuildStages ?? [],
        kit: kit ? { id: kit.id, name: kit.name, sku: kit.sku ?? null, skuComponents: (kit.skuComponents ?? null) } : null,
        upgrades: selectedUpgrades.map(u => ({ id: u.id, name: u.name, category: u.category, variantName: u.variantName ?? null, sku: u.sku ?? null, skuComponents: u.skuComponents ?? null })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch build progress" });
    }
  });

  app.patch("/api/build-progress/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Not found" });
      const stageEntry = z.union([z.string(), z.object({ id: z.string(), initials: z.string() })]);
      const body = z.object({
        completedBuildStages: z.array(stageEntry),
      }).parse(req.body);
      await storage.updateQuote(req.params.id, { completedBuildStages: body.completedBuildStages } as any);

      // Auto-seed Due-By when artwork_approved is freshly ticked via the
      // admin build-progress PATCH. Mirrors the public stage-tick endpoint
      // so it doesn't matter whether the staff member ticks it from the
      // QR workshop view or directly inside the build sheet.
      const wasApproved = ((quote as any).completedBuildStages ?? []).some(
        (e: any) => (typeof e === "string" ? e : e?.id) === "artwork_approved"
      );
      const isApproved = body.completedBuildStages.some(
        (e) => (typeof e === "string" ? e : e?.id) === "artwork_approved"
      );
      if (!wasApproved && isApproved) {
        const { WEEK_MS: _WK, DUE_BY_LEAD_WEEKS_MAX: _MAX } = await import("@shared/dueByCountdown");
        const approvedAt = (quote as any).artworkApprovedAt ? new Date((quote as any).artworkApprovedAt) : new Date();
        if (!(quote as any).artworkApprovedAt) {
          await pool.query(
            `UPDATE quotes SET artwork_approved_at = $1 WHERE id = $2 AND artwork_approved_at IS NULL`,
            [approvedAt, req.params.id]
          );
        }
        const seededTarget = new Date(approvedAt.getTime() + _MAX * _WK);
        await pool.query(
          `UPDATE quotes SET target_completion_date = $1 WHERE id = $2 AND target_completion_date IS NULL`,
          [seededTarget, req.params.id]
        );
      }

      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update build progress" });
    }
  });

  // Public build progress page — looked up by confirmationToken (no auth required)
  app.get("/api/build-progress-public/:token", async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const quote = await storage.getQuoteByConfirmationToken(req.params.token);
      if (!quote) return res.status(404).json({ error: "Not found" });

      const kit = quote.kitId ? await storage.getKit(quote.kitId) : null;
      const allUpgrades = await storage.getAllUpgradesAdmin();
      // Dedupe by parentId — variant groups are radio-style in the configurator.
      // The configurator picks the FIRST variant in `selectedUpgradeIds` that
      // belongs to a given parent (see client SelectUpgrades.tsx), so we
      // follow the exact same rule on the workshop floor. Iterate the saved
      // array in order, keep first-per-parent.
      const savedOrder = (Array.isArray(quote.selectedUpgradeIds) ? quote.selectedUpgradeIds : []) as string[];
      const upgradesById = new Map(allUpgrades.map((u) => [u.id, u] as const));
      const seenParents = new Set<string>();
      const dedupedUpgrades: any[] = [];
      for (const id of savedOrder) {
        const u: any = upgradesById.get(id);
        if (!u) continue;
        const pid = u.parentId as string | null | undefined;
        if (pid) {
          if (seenParents.has(pid)) continue;
          seenParents.add(pid);
        }
        dedupedUpgrades.push(u);
      }
      // Sort by category then sortOrder so every quote renders in the same order
      const selectedUpgrades = await sortUpgradesByDisplayOrder(dedupedUpgrades as any[]);

      // Generate stages the same way the kiosk board does (client-side logic mirrored here)
      // Wrap pattern also matches Graphic Pack / Half Wrap so artwork & printed stages apply
      const isWrap = (u: { category?: string | null; name?: string | null }) => {
        const c = (u.category ?? "").toLowerCase();
        const n = (u.name ?? "").toLowerCase();
        // Full Wrap / Half Wrap live in the "branding" category, so we also
        // sniff the upgrade name for "wrap" / "graphic" — otherwise the
        // artwork stages (Artwork Sent / Approved / Wrap Printed) never get
        // generated for those upgrades.
        return c.includes("wrap") || c.includes("graphic") ||
          n.includes("wrap") || n.includes("graphic");
      };
      const isWall = (u: { category?: string | null }) =>
        (u.category ?? "").toLowerCase().includes("interior wall");
      const isBusinessPack = (u: { name?: string | null }) =>
        /business\s*pack|business\s*package/i.test(u.name ?? "");
      // 48V silent-compressor systems are split into two sub-stages so the
      // auto-electrician can sign off the wiring independently of the
      // fitter bolting the compressor in.
      const is48vSystem = (u: { name?: string | null }) =>
        /48\s*v|silent\s+compressor/i.test(u.name ?? "");
      // Priority upgrades that always sit right after the install pack
      const priorityRank = (name: string): number => {
        const n = name.toLowerCase();
        if (n.includes("48v")) return 0;
        if (n.includes("super spin")) return 1;
        if (n.includes("t4000") || n.includes("t-4000")) return 2;
        return 99;
      };
      const orderByPriority = <T extends { name: string }>(items: T[]) =>
        [...items].sort((a, b) => priorityRank(a.name) - priorityRank(b.name));

      const customStages = (quote as any).customBuildStages as Array<{ id: string; label: string }> | null;
      let stages: Array<{ id: string; label: string }>;
      if (customStages && customStages.length > 0) {
        stages = customStages;
      } else {
        stages = [];
        stages.push({ id: "prep", label: "Van Preparation" });
        if (kit) stages.push({ id: "kit", label: `Install ${kit.name}` });
        const nonWrap = orderByPriority(selectedUpgrades.filter((u) => !isWrap(u) && !isWall(u)));
        const wrapOnly = selectedUpgrades.filter((u) => isWrap(u) && !isWall(u));
        const wallOnly = selectedUpgrades.filter((u) => isWall(u) && !isWrap(u));
        // Prefer the variant_name when set — two upgrades can share the same
        // parent name (e.g. all CCTV variants are stored as "Van Online
        // CCTV/NVR System") so the variant name is the only thing that
        // distinguishes them on the workshop floor.
        // Prefix the stage label with "N× " when the customer has ordered
        // more than one of an item — so the workshop sees "2× Compressor"
        // instead of just "Compressor" for double-orders. Mirrors the build
        // sheet's qty display.
        const qtyMap = (quote.selectedUpgrades ?? {}) as Record<string, number>;
        const stageLabel = (u: { id: string; name: string; variantName?: string | null }) => {
          const base = (u.variantName && u.variantName.trim()) ? u.variantName.trim() : u.name;
          const q = qtyMap[u.id] ?? 1;
          return q > 1 ? `${q}× ${base}` : base;
        };
        for (const u of nonWrap) {
          if (is48vSystem(u)) {
            const base = stageLabel(u);
            stages.push({ id: `upg_${u.id}_electrics`, label: `${base} — Electrics` });
            stages.push({ id: `upg_${u.id}_fit`, label: `${base} — Compressor Fit` });
          } else {
            stages.push({ id: `upg_${u.id}`, label: stageLabel(u) });
            if (isBusinessPack(u)) {
              stages.push({ id: `upg_${u.id}_website`, label: "Website Done" });
              stages.push({ id: `upg_${u.id}_print`, label: "Leaflets & Business Cards Ordered" });
            }
          }
        }
        if (wrapOnly.length > 0) {
          stages.push({ id: "artwork_sent", label: "Artwork Sent" });
          stages.push({ id: "artwork_approved", label: "Artwork Approved" });
          stages.push({ id: "wrap_printed", label: "Wrap Printed" });
        }
        for (const u of wrapOnly) stages.push({ id: `upg_${u.id}`, label: stageLabel(u) });
        if (wallOnly.length > 0) {
          stages.push({ id: "interior_walls_artwork_sent", label: "Interior Walls Artwork Sent" });
          stages.push({ id: "interior_wall_artwork_approved", label: "Interior Wall Artwork Approved" });
          stages.push({ id: "interior_walls_ordered", label: "Interior Walls Ordered" });
        }
        for (const u of wallOnly) stages.push({ id: `upg_${u.id}`, label: stageLabel(u) });
        stages.push({ id: "final_checks", label: "Final Checks" });
        stages.push({ id: "valet", label: "Valet & Handover" });
      }

      const rawCompleted = ((quote as any).completedBuildStages ?? []) as Array<string | { id: string; initials: string }>;
      const completedStages = rawCompleted.map((e) =>
        typeof e === "string" ? { id: e, initials: null } : { id: e.id, initials: e.initials ?? null }
      );

      const publicVan = quote.vanId ? await storage.getVan(quote.vanId) : null;
      // Resolve the plate the same way the shared client helper resolveVanReg
      // (client/src/lib/vanDisplay.ts) does: a typed reg wins, but only when
      // it's actually non-empty; otherwise fall back to the chosen stock van's
      // own plate, then the free-text van description. Using a plain `??` would
      // keep an empty/whitespace vanRegistration and never reveal a stock van's
      // plate to the customer.
      const typedReg = quote.vanRegistration?.trim();
      const vanRegistration =
        (typedReg && typedReg.length > 0 ? typedReg : null) ??
        publicVan?.reg ??
        quote.customVanDescription ??
        null;
      res.json({
        customerName: quote.userName,
        vanRegistration,
        company: quote.company ?? null,
        stages,
        completedStages,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch build progress" });
    }
  });

  // Public workshop stage tick — no auth, token acts as the key
  app.patch("/api/build-progress-public/:token/stage", async (req, res) => {
    try {
      const quote = await storage.getQuoteByConfirmationToken(req.params.token);
      if (!quote) return res.status(404).json({ error: "Not found" });

      // Whitelist of stage-id shapes the generator can emit, plus any
      // staff-defined customBuildStages on the quote. Prevents arbitrary
      // string injection via the public token.
      const FIXED_STAGE_IDS = new Set([
        "prep", "kit",
        "artwork_sent", "artwork_approved", "wrap_printed",
        "interior_walls_artwork_sent", "interior_wall_artwork_approved", "interior_walls_ordered",
        "final_checks", "valet",
      ]);
      const UPGRADE_STAGE_RE = /^upg_[A-Za-z0-9_-]+(_website|_print)?$/;
      const customIds = new Set(
        ((quote as any).customBuildStages ?? []).map((s: any) => s?.id).filter((x: any) => typeof x === "string")
      );

      const body = z.object({
        stageId: z.string().refine(
          (id) => FIXED_STAGE_IDS.has(id) || UPGRADE_STAGE_RE.test(id) || customIds.has(id),
          { message: "Unknown stageId" },
        ),
        completed: z.boolean(),
        initials: z.string().min(1).max(10),
        // Required only on untick — proves the person undoing is who they say
        pin: z.string().optional(),
      }).parse(req.body);

      const raw = ((quote as any).completedBuildStages ?? []) as Array<string | { id: string; initials: string }>;

      // Undo protection: only the person who marked a stage done can undo it,
      // AND they must enter their 4-digit kiosk PIN (stops mistaps from
      // unticking someone else's work just by picking their name).
      if (!body.completed) {
        const existing = raw.find((e) => (typeof e === "string" ? e : e.id) === body.stageId);
        const tickedBy = existing && typeof existing !== "string" ? (existing.initials ?? null) : null;
        if (tickedBy && tickedBy !== body.initials.toUpperCase()) {
          return res.status(403).json({ error: `This stage was ticked by ${tickedBy} — only they can undo it.` });
        }
        // PIN check — pulled from env (KIOSK_PIN_<INITIALS>). Missing env =
        // undo disabled for that person. Constant-time compare keeps us
        // honest about side-channels even on a tiny 4-digit secret.
        const initialsUpper = body.initials.toUpperCase();
        // PIN lookup order: admin-managed DB setting first, then env var
        // fallback for back-compat with secrets set before the admin UI
        // existed. DB wins so an admin override always takes effect.
        const settings = await storage.getSiteSettings();
        const expected = settings[`kiosk_pin_${initialsUpper.toLowerCase()}`] || process.env[`KIOSK_PIN_${initialsUpper}`];
        if (!expected) {
          return res.status(403).json({ error: `No PIN set for ${initialsUpper} — an admin can set one in Admin → Settings → Kiosk PINs.` });
        }
        const supplied = (body.pin ?? "").trim();
        const a = Buffer.from(expected);
        const b = Buffer.from(supplied);
        const ok = a.length === b.length && (await import("node:crypto")).timingSafeEqual(a, b);
        if (!ok) {
          return res.status(403).json({ error: "Wrong PIN" });
        }
      }

      let updated: Array<string | { id: string; initials: string }>;
      if (body.completed) {
        const alreadyIn = raw.some((e) => (typeof e === "string" ? e : e.id) === body.stageId);
        updated = alreadyIn ? raw : [...raw, { id: body.stageId, initials: body.initials.toUpperCase() }];
      } else {
        updated = raw.filter((e) => (typeof e === "string" ? e : e.id) !== body.stageId);
      }

      await storage.updateQuote(quote.id, { completedBuildStages: updated } as any);

      // Auto-seed artwork_approved_at + target_completion_date the first time
      // the artwork_approved stage is ticked. Mirrors the WrapGen webhook so
      // staff ticking the box gets the same 6/9-week countdown behaviour.
      if (body.stageId === "artwork_approved" && body.completed) {
        const { WEEK_MS: _WK, DUE_BY_LEAD_WEEKS_MAX: _MAX } = await import("@shared/dueByCountdown");
        const approvedAt = (quote as any).artworkApprovedAt ? new Date((quote as any).artworkApprovedAt) : new Date();
        if (!(quote as any).artworkApprovedAt) {
          await pool.query(
            `UPDATE quotes SET artwork_approved_at = $1, artwork_approved_by = COALESCE(artwork_approved_by, $2) WHERE id = $3`,
            [approvedAt, body.initials.toUpperCase(), quote.id]
          );
        }
        const seededTarget = new Date(approvedAt.getTime() + _MAX * _WK);
        await pool.query(
          `UPDATE quotes SET target_completion_date = $1 WHERE id = $2 AND target_completion_date IS NULL`,
          [seededTarget, quote.id]
        );
      }

      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update stage" });
    }
  });

  // Return (or generate) the confirmationToken for QR label printing
  app.get("/api/admin/quotes/:id/progress-token", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      let quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Not found" });

      let token = quote.confirmationToken;
      if (!token) {
        const { randomBytes } = await import("crypto");
        token = randomBytes(24).toString("hex");
        await storage.updateQuote(req.params.id, { confirmationToken: token } as any);
      }

      const kit = quote.kitId ? await storage.getKit(quote.kitId) : null;
      const tokenVan = quote.vanId ? await storage.getVan(quote.vanId) : null;
      res.json({
        token,
        vanRegistration: quote.vanRegistration ?? tokenVan?.reg ?? quote.customVanDescription ?? null,
        userName: quote.userName,
        company: quote.company ?? null,
        kitName: kit?.name ?? null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get progress token" });
    }
  });

  // Build sheet PDF download — renders the build sheet page headlessly and returns an A4 PDF
  app.get("/api/admin/quotes/:id/build-sheet.pdf", isAuthenticated, isBasicAdmin, async (req, res) => {
    const quoteId = req.params.id;
    const port = parseInt(process.env.PORT || "5000", 10);
    const baseUrl = `http://localhost:${port}`;
    const targetUrl = `${baseUrl}/admin/quotes/${quoteId}/build-sheet`;

    // Extract the session cookie so the headless browser can access admin pages
    const sessionCookie = req.headers.cookie ?? "";

    let browser;
    try {
      browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
      const context = await browser.newContext({
        extraHTTPHeaders: { cookie: sessionCookie },
      });
      const page = await context.newPage();

      // Block media/video to speed up the render
      await page.route("**/*.mp4", route => route.abort());
      await page.route("**/*.webm", route => route.abort());

      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });

      // Build filename from quote data — strip unsafe characters for Content-Disposition
      const sanitize = (s: string) => s.replace(/\s+/g, "").replace(/[^\w-]/g, "");
      const quote = await storage.getQuote(quoteId);
      const customerName = sanitize(quote?.userName ?? "");
      const reg = sanitize(((quote as any)?.vanRegistration ?? "")).toUpperCase();
      const parts = ["BuildSheet", customerName, reg].filter(Boolean);
      const filename = `${parts.join("-")}.pdf`;

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(Buffer.from(pdfBuffer));
    } catch (err) {
      console.error("[PDF] Build sheet PDF generation failed:", err);
      res.status(500).json({ error: "PDF generation failed" });
    } finally {
      if (browser) await browser.close();
    }
  });

  // Lightweight badge counts for the admin shell — COUNT(*) queries instead
  // of shipping the full quotes/leads/conversations tables every poll.
  app.get("/api/admin/counts", isAuthenticated, isBasicAdmin, async (_req, res) => {
    try {
      const [quotes, leads, convos] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS count FROM quotes WHERE status = 'new'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM leads WHERE status = 'new'`),
        pool.query(`SELECT COUNT(*)::int AS count FROM ai_conversations
                    WHERE contact_phone IS NOT NULL AND contact_phone <> ''
                      AND (marked_contacted IS NOT TRUE)`),
      ]);
      res.json({
        newQuotes: quotes.rows[0].count,
        newLeads: leads.rows[0].count,
        uncontactedConversations: convos.rows[0].count,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch counts" });
    }
  });

  // Admin only - list all quotes (basic admins can view)
  app.get("/api/quotes", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const quotes = await storage.getQuotes();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  // Secure quotes detail endpoint - admin only (basic admins can view)
  app.get("/api/quotes/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  // Strip duplicate variants from a quote's selectedUpgradeIds: only one
  // variant per parent group should ever be saved (the configurator UI is
  // radio-style). Rule: keep the FIRST occurrence per parent in the saved
  // array — this exactly mirrors the configurator's display logic
  // (`state.upgradeIds.find(...)` in SelectUpgrades.tsx), so whatever
  // variant the customer sees in the configurator is the one that gets
  // saved and built.
  const dedupeUpgradeIdsByParent = async (ids: string[]): Promise<string[]> => {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const fetched = await Promise.all(ids.map((id) => storage.getUpgrade(id)));
    const seenParents = new Set<string>();
    const out: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const u: any = fetched[i];
      if (!u) { out.push(ids[i]); continue; }
      const pid = u.parentId as string | null | undefined;
      if (!pid) { out.push(ids[i]); continue; }
      if (seenParents.has(pid)) continue;
      seenParents.add(pid);
      out.push(ids[i]);
    }
    return out;
  };

  app.post("/api/quotes", async (req, res) => {
    try {
      const validatedData = insertQuoteSchema.parse(req.body);

      // Privileged fields may only be set by authenticated admins. Public
      // configurator submissions must not be able to self-apply discounts,
      // defer VAT, or inject themselves into the pipeline with a status.
      const requestUser = await getCurrentUser(req);
      const isAdminRequest = !!requestUser && ["basic", "full"].includes((requestUser as any).adminRole);
      if (!isAdminRequest) {
        for (const field of [
          "status", "financeStatus", "buildStage", "discountType", "discountValue",
          "vatDeferred", "adminNotesHistory", "customerNotesHistory",
          "confirmationToken", "chooseOptionToken", "financeSentAt",
          "financeDecisionAt", "customerId", "estDiscount",
        ]) {
          delete (validatedData as any)[field];
        }
      }

      // Dedupe variant duplicates before pricing & saving
      if (Array.isArray(validatedData.selectedUpgradeIds) && validatedData.selectedUpgradeIds.length > 0) {
        validatedData.selectedUpgradeIds = await dedupeUpgradeIdsByParent(validatedData.selectedUpgradeIds as string[]);
      }

      // Fetch all referenced entities to recalculate prices server-side
      const selectedUpgradeIds = (validatedData.selectedUpgradeIds || []) as string[];
      const selectedTrainingOptionIds = (validatedData.trainingOptionIds || []) as string[];
      const [van, kit, upgrades, trainingOptions] = await Promise.all([
        validatedData.vanId ? storage.getVan(validatedData.vanId) : Promise.resolve(null),
        validatedData.kitId ? storage.getKit(validatedData.kitId) : Promise.resolve(null),
        selectedUpgradeIds.length > 0
          ? Promise.all(selectedUpgradeIds.map((id: string) => storage.getUpgrade(id)))
          : Promise.resolve([]),
        selectedTrainingOptionIds.length > 0
          ? Promise.all(selectedTrainingOptionIds.map((id: string) => storage.getTrainingOption(id)))
          : Promise.resolve([])
      ]);

      // Validate that all entities exist
      if (validatedData.vanId && !van) {
        return res.status(400).json({ error: "Selected van not found" });
      }
      if (validatedData.kitId && !kit) {
        return res.status(400).json({ error: "Selected kit not found" });
      }
      if (upgrades.some((u: any) => !u)) {
        return res.status(400).json({ error: "One or more selected upgrades not found" });
      }
      if (trainingOptions.some((t: any) => !t)) {
        return res.status(400).json({ error: "One or more selected training options not found" });
      }

      // Calculate server-side pricing (all prices in pence) with quantities
      // Use custom van value when no system van is selected
      const vanPrice = vanNetPrice(van, validatedData.customVanValue);
      const kitPrice = kit?.price || 0;
      const upgradesTotal = upgrades.reduce((sum: number, upgrade: any) => {
        const quantity = validatedData.selectedUpgrades?.[upgrade.id] || 1;
        return sum + (upgrade?.price || 0) * quantity;
      }, 0);
      const trainingTotal = trainingOptions.reduce((sum: number, trainingOption: any) => {
        return sum + (trainingOption?.price || 0);
      }, 0);
      const submittedCustomExtras = (req.body.customExtras || []) as Array<{id: string; description: string; pricePence: number}>;
      const customExtrasTotal = submittedCustomExtras.reduce((sum: number, e: any) => sum + (e.pricePence || 0), 0);

      const subtotal = vanPrice + kitPrice + upgradesTotal + trainingTotal + customExtrasTotal;
      const vatDeferred = validatedData.vatDeferred === true;
      const vat = vatDeferred ? 0 : Math.round(subtotal * VAT_RATE);
      const total = subtotal + vat;

      // Validate client-submitted prices match server calculation
      // Allow small tolerance for rounding differences (within 1 pence)
      const priceTolerance = 1;
      if (
        Math.abs(validatedData.estSubtotal - subtotal) > priceTolerance ||
        Math.abs(validatedData.estVAT - vat) > priceTolerance ||
        Math.abs(validatedData.estTotal - total) > priceTolerance
      ) {
        console.error('Price mismatch:', {
          submitted: { subtotal: validatedData.estSubtotal, vat: validatedData.estVAT, total: validatedData.estTotal },
          calculated: { subtotal, vat, total }
        });
        return res.status(400).json({ 
          error: "Price validation failed. Please refresh and try again.",
          details: {
            expectedSubtotal: subtotal,
            expectedVAT: vat,
            expectedTotal: total
          }
        });
      }

      // Apply discount if provided (discount is on the VAT-inclusive total)
      const discountType = (validatedData.discountType ?? null) as "percentage" | "fixed" | null;
      const discountValue = validatedData.discountValue ?? null;
      const totals = computeQuoteTotals({ subtotal, discountType, discountValue, vatDeferred });
      const discountAmount = totals.discountAmount;
      const finalTotal = totals.totalAfterDiscount;

      // If comparison mode: compute pricing for slotB server-side and normalize slotA from server-validated primary fields.
      // This ensures that the comparisonConfig stored in the DB is authoritative for both slots —
      // client-submitted slotA pricing is overwritten with server-computed values.
      let enrichedComparisonConfig: Quote['comparisonConfig'] = validatedData.comparisonConfig as Quote['comparisonConfig'] ?? null;
      if (enrichedComparisonConfig?.slotA) {
        // Normalize slotA with server-validated primary quote data (already computed above)
        // This prevents client-crafted slotA prices from being promoted later via choose-option
        enrichedComparisonConfig = {
          ...enrichedComparisonConfig,
          slotA: {
            ...enrichedComparisonConfig.slotA,
            estSubtotal: totals.finalSubtotal,
            estVAT: totals.finalVAT,
            estTotal: totals.totalAfterDiscount,
          },
        };
      }
      if (enrichedComparisonConfig?.slotB) {
        const slotB = enrichedComparisonConfig.slotB;
        try {
          const slotBUpgradeIds: string[] = slotB.upgradeIds || [];
          const slotBTrainingIds: string[] = slotB.trainingOptionIds || [];
          const [slotBVanData, slotBKitData, slotBUpgradeData, slotBTrainingData] = await Promise.all([
            slotB.vanId ? storage.getVan(slotB.vanId) : Promise.resolve(null),
            slotB.kitId ? storage.getKit(slotB.kitId) : Promise.resolve(null),
            slotBUpgradeIds.length > 0
              ? Promise.all(slotBUpgradeIds.map((uid) => storage.getUpgrade(uid)))
              : Promise.resolve([]),
            slotBTrainingIds.length > 0
              ? Promise.all(slotBTrainingIds.map((tid) => storage.getTrainingOption(tid)))
              : Promise.resolve([]),
          ]);
          // Slot B shares the quote's upgrade quantity map with slot A, so
          // its subtotal must apply the same quantities.
          const slotBQuantities = (validatedData.selectedUpgrades as Record<string, number>) || {};
          const slotBSubtotal =
            vanNetPrice(slotBVanData, slotB.customVanValue) +
            (slotBKitData?.price ?? 0) +
            slotBUpgradeData.filter(Boolean).reduce((s, u: any) => s + ((u?.price ?? 0) * (slotBQuantities[u?.id] || 1)), 0) +
            slotBTrainingData.filter(Boolean).reduce((s, t) => s + ((t as { price: number })?.price ?? 0), 0);
          // Apply Option B's own discount when set, else fall back to the
          // main-quote discount (which belongs to Option A) so Option B is
          // discounted consistently when no per-slot override is configured.
          const slotBTotals = computeQuoteTotals({
            subtotal: slotBSubtotal,
            discountType: ((slotB as any).discountType ?? discountType) as any,
            discountValue: Number((slotB as any).discountValue ?? discountValue) || null,
            vatDeferred,
          });
          enrichedComparisonConfig = {
            ...enrichedComparisonConfig,
            slotB: {
              ...slotB,
              estSubtotal: slotBTotals.finalSubtotal,
              estVAT: slotBTotals.finalVAT,
              estTotal: slotBTotals.totalAfterDiscount,
              estDiscount: slotBTotals.discountAmount,
            },
          };
        } catch (err) {
          console.error('Failed to compute slotB pricing:', err);
        }
      }

      // Create quote with server-validated prices and user ID if authenticated
      const quoteData = {
        ...validatedData,
        userId: req.session.user?.id || null,
        // Stored est* figures are post-discount (same semantics as the PATCH
        // recalculation and the email templates that render them).
        estSubtotal: totals.finalSubtotal,
        estVAT: totals.finalVAT,
        estTotal: finalTotal,       // post-discount total
        estDiscount: discountAmount, // 0 when no discount
        ...(enrichedComparisonConfig !== null ? { comparisonConfig: enrichedComparisonConfig } : {}),
      };

      const quote = await storage.createQuote(quoteData);

      // Auto-link / create a unified Customer record (non-blocking, best-effort)
      // Use || (not ??) so empty strings fall through to the "Unknown" fallback
      const customerName = validatedData.name || validatedData.userName || validatedData.email || "Unknown";
      const customerEmail = validatedData.email || null;
      const customerPhone = validatedData.phone || null;
      storage.findOrCreateCustomer(customerEmail, customerPhone, customerName as string)
        .then(customer =>
          storage.linkQuoteToCustomer(quote.id, customer.id, "System (auto-link)")
            .then(() => storage.backfillLeadsAndQuotesForCustomer(customer.id, customerEmail, customerPhone))
        )
        .catch(err => console.error("Customer auto-link (quote) error:", err?.message));

      // For comparison quotes, generate a choose-option token immediately so the initial
      // customer confirmation email can include secure selection links.
      let initialChooseOptionToken: string | undefined;
      if (enrichedComparisonConfig?.slotA && enrichedComparisonConfig?.slotB) {
        const { randomBytes } = await import('crypto');
        initialChooseOptionToken = randomBytes(32).toString('hex');
        await storage.updateQuote(quote.id, { chooseOptionToken: initialChooseOptionToken });
      }

      // Back-fill AI conversation with contact details if the quote came from an AI session
      const aiSessionId = req.body.aiSessionId as string | undefined;
      if (aiSessionId) {
        // Store the link on the quote itself (so we can join later)
        pool.query(`UPDATE quotes SET ai_session_id = $1 WHERE id = $2`, [aiSessionId, quote.id])
          .catch(err => console.error("Quote AI session link error:", err.message));

        if (validatedData.name || validatedData.phone) {
          pool.query(
            `UPDATE ai_conversations
             SET contact_name = COALESCE(contact_name, $2),
                 contact_phone = COALESCE(contact_phone, $3),
                 config_completed = TRUE,
                 completed_at = COALESCE(completed_at, NOW()),
                 status = CASE WHEN status = 'in_progress' THEN 'completed' ELSE status END
             WHERE session_id = $1`,
            [aiSessionId, validatedData.name ?? null, validatedData.phone ?? null]
          ).catch(err => console.error("AI conversation back-fill error:", err.message));
        }
      }

      // Send confirmation email to customer + notification to admin (non-blocking)
      try {
        const { sendQuoteReceivedEmails } = await import('./email.js');

        // If comparison mode: fetch slotB details for email (pricing already computed in enrichedComparisonConfig)
        let comparisonSlotBEmail: { vanTitle?: string | null; kitName?: string | null; upgradeNames?: string[]; estSubtotal?: number; estVAT?: number; estTotal?: number } | null = null;
        const emailSlotB = enrichedComparisonConfig?.slotB;
        if (emailSlotB) {
          // In compare mode, kit/upgrades are always shared from Option A — use the primary selectedUpgradeIds
          // so Option B always shows the same equipment as Option A regardless of what was stored in slotB.upgradeIds
          const emailSlotBUpgradeIds: string[] = (quoteData.selectedUpgradeIds as string[]) || emailSlotB.upgradeIds || [];
          const [slotBVan, slotBKit, slotBUpgrades] = await Promise.all([
            emailSlotB.vanId ? storage.getVan(emailSlotB.vanId) : Promise.resolve(null),
            emailSlotB.kitId ? storage.getKit(emailSlotB.kitId) : Promise.resolve(null),
            emailSlotBUpgradeIds.length > 0
              ? Promise.all(emailSlotBUpgradeIds.map((uid) => storage.getUpgrade(uid)))
              : Promise.resolve([]),
          ]);
          const emailSlotBUpgradesOrdered = await sortUpgradesByDisplayOrder(slotBUpgrades.filter(Boolean) as any[]);
          // In compare mode, slot B shares quantities with slot A (same upgradeQuantities)
          const emailQuantities: Record<string, number> = (validatedData.selectedUpgrades as Record<string, number>) || {};
          comparisonSlotBEmail = {
            vanTitle: slotBVan?.title ?? (emailSlotB.vanRegistration ? `Own van (${emailSlotB.vanRegistration})` : null),
            kitName: slotBKit?.name ?? null,
            upgradeNames: emailSlotBUpgradesOrdered.map((u: any) => {
              const qty = emailQuantities[u.id] ?? 1;
              return qty > 1 ? `${u.name} ×${qty}` : u.name;
            }),
            estSubtotal: emailSlotB.estSubtotal,
            estVAT: emailSlotB.estVAT,
            estTotal: emailSlotB.estTotal,
          };
        }

        // Compute finance figures for both options if financeInputs were provided.
        // Use the quote's actual finance plan APR when one is selected; only
        // fall back to the representative 10.9% when no plan is attached.
        const emailFinancePlan = quote.financePlanId ? await storage.getFinancePlan(quote.financePlanId) : null;
        const emailAprBps = emailFinancePlan?.aprBps ?? 1090;
        type FinanceInfo = { depositAmount: number; termMonths: number; monthlyPayment: number; weeklyPayment: number };
        function calcFinanceForEmail(totalPence: number, fi: { deposit?: number; term?: number } | null | undefined): FinanceInfo | null {
          if (!fi || !fi.term || fi.term <= 0 || totalPence <= 0) return null;
          const depositPence = fi.deposit ?? 0;
          const payments = computeFinancePayments(totalPence, depositPence, fi.term, emailAprBps);
          if (!payments) return null;
          return {
            depositAmount: depositPence,
            termMonths: fi.term,
            ...payments,
          };
        }
        const fi = quote.financeInputs as { deposit?: number; term?: number } | null | undefined;
        const financeInfoA = comparisonSlotBEmail ? calcFinanceForEmail(quote.estTotal, fi) : null;
        const financeInfoB = (comparisonSlotBEmail && comparisonSlotBEmail.estTotal != null)
          ? calcFinanceForEmail(comparisonSlotBEmail.estTotal, fi)
          : null;

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        await sendQuoteReceivedEmails({
          quote,
          vanTitle: van?.title ?? null,
          kitName: kit?.name ?? null,
          upgradeNames: (await sortUpgradesByDisplayOrder(upgrades.filter(Boolean) as any[])).map((u: any) => {
            const qty = (validatedData.selectedUpgrades as Record<string, number>)?.[u.id] ?? 1;
            return qty > 1 ? `${u.name} ×${qty}` : u.name;
          }),
          comparisonSlotB: comparisonSlotBEmail,
          financeInfoA: financeInfoA ?? undefined,
          financeInfoB: financeInfoB ?? undefined,
          // chosenOption is null at submission time (admin chooses later), but wired here
          // so resend/re-trigger email paths can pass the current chosen state
          chosenOption: null,
          baseUrl: comparisonSlotBEmail ? baseUrl : undefined,
          chooseOptionToken: comparisonSlotBEmail ? initialChooseOptionToken : undefined,
        });
      } catch (emailErr) {
        console.error('Failed to send quote received emails:', emailErr);
      }

      res.status(201).json(quote);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid quote data", details: error.message });
      }
      console.error('Quote creation error:', error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  });

  // Leads endpoints — listing lives at /api/admin/leads (admin-only); the
  // public surface is submission only.
  app.post("/api/leads", async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(validatedData);

      // Auto-link / create a unified Customer record (non-blocking, best-effort)
      const leadCustomerName = validatedData.name ?? validatedData.email ?? "Unknown";
      const leadCustomerEmail = validatedData.email ?? null;
      const leadCustomerPhone = validatedData.phone ?? null;
      if (leadCustomerName || leadCustomerEmail || leadCustomerPhone) {
        storage.findOrCreateCustomer(leadCustomerEmail, leadCustomerPhone, leadCustomerName as string)
          .then(customer =>
            storage.linkLeadToCustomer(lead.id, customer.id, "System (auto-link)")
              .then(() => storage.backfillLeadsAndQuotesForCustomer(customer.id, leadCustomerEmail, leadCustomerPhone))
          )
          .catch(err => console.error("Customer auto-link (lead) error:", err?.message));
      }

      // Send confirmation email to customer + notification to admin (non-blocking)
      try {
        const { sendLeadReceivedEmails } = await import('./email.js');
        await sendLeadReceivedEmails(lead);
      } catch (emailErr) {
        console.error('Failed to send lead received emails:', emailErr);
      }

      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ error: "Invalid lead data" });
    }
  });

  // Finance Plans endpoints - public (published only)
  app.get("/api/finance-plans", async (req, res) => {
    try {
      const plans = await storage.getFinancePlans();
      const publishedPlans = plans.filter(p => p.published);
      res.json(publishedPlans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch finance plans" });
    }
  });

  app.get("/api/finance-plans/:id", async (req, res) => {
    try {
      const plan = await storage.getFinancePlan(req.params.id);
      if (!plan || !plan.published) {
        return res.status(404).json({ error: "Finance plan not found" });
      }
      res.json(plan);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch finance plan" });
    }
  });

  // Training Options endpoints - public (published only)
  app.get("/api/training-options", async (req, res) => {
    try {
      const options = await storage.getTrainingOptions();
      res.json(options);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training options" });
    }
  });

  app.get("/api/training-options/:id", async (req, res) => {
    try {
      const option = await storage.getTrainingOption(req.params.id);
      if (!option || !option.published) {
        return res.status(404).json({ error: "Training option not found" });
      }
      res.json(option);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training option" });
    }
  });

  // Configurator endpoints
  app.get("/api/configurator/data", async (req, res) => {
    try {
      const [kits, upgrades, financePlans, trainingOptions, categoriesResult] = await Promise.all([
        storage.getKits(),
        storage.getUpgrades(),
        storage.getFinancePlans(),
        storage.getTrainingOptions(),
        pool.query(`SELECT id, label, sort_order AS "sortOrder" FROM upgrade_categories ORDER BY sort_order ASC, label ASC`)
      ]);
      
      // Group upgrades by category
      const upgradesByCategory = upgrades.reduce((acc, upgrade) => {
        if (!acc[upgrade.category]) {
          acc[upgrade.category] = [];
        }
        acc[upgrade.category].push(upgrade);
        return acc;
      }, {} as Record<string, typeof upgrades>);
      
      
      res.json({
        kits,
        upgrades: upgradesByCategory,
        categories: categoriesResult.rows,
        financePlans: financePlans.filter(p => p.published),
        trainingOptions: trainingOptions.filter(o => o.published)
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch configurator data" });
    }
  });

  app.post("/api/configurator/calculate", async (req, res) => {
    try {
      // Validate request body
      const bodySchema = z.object({
        vanId: z.string().optional(),
        kitId: z.string().optional(),
        upgradeIds: z.array(z.string()).default([]),
        upgradeQuantities: z.record(z.number()).default({}),
        trainingOptionIds: z.array(z.string()).default([])
      });
      
      const { vanId, kitId, upgradeIds, upgradeQuantities, trainingOptionIds } = bodySchema.parse(req.body);
      
      let subtotal = 0;
      
      // Add van price if selected
      if (vanId) {
        const van = await storage.getVan(vanId);
        if (van) {
          subtotal += van.price;
        }
      }
      
      // Add kit price
      if (kitId) {
        const kit = await storage.getKit(kitId);
        if (kit) {
          subtotal += kit.price;
        }
      }
      
      // Add upgrade prices (with quantities)
      for (const upgradeId of upgradeIds) {
        const upgrade = await storage.getUpgrade(upgradeId);
        if (upgrade) {
          const quantity = upgradeQuantities[upgradeId] || 1;
          subtotal += upgrade.price * quantity;
        }
      }
      
      // Add training option prices
      for (const trainingOptionId of trainingOptionIds) {
        const trainingOption = await storage.getTrainingOption(trainingOptionId);
        if (trainingOption) {
          subtotal += trainingOption.price;
        }
      }
      
      const vat = Math.round(subtotal * 0.2); // 20% VAT
      const total = subtotal + vat;
      
      res.json({
        subtotal,
        vat,
        total,
        vatRate: 0.2
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate price" });
    }
  });

  // Admin CRUD endpoints for vans
  app.get("/api/admin/vans", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const [vans, quotes] = await Promise.all([
        storage.getVansAdmin(),
        storage.getVanSaleStatusRows(),
      ]);
      const withStatus = vans.map((van) => attachSaleStatus(van, quotes));
      res.json(withStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vans" });
    }
  });

  app.post("/api/admin/vans", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const vanData = insertVanSchema.parse(req.body);
      const van = await storage.createVan(vanData);
      res.json(van);
    } catch (error) {
      console.error("Van creation error:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.errors 
        });
      }
      res.status(400).json({ error: "Failed to create van" });
    }
  });

  app.put("/api/admin/vans/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const vanData = insertVanSchema.partial().parse(req.body);
      const van = await storage.updateVan(req.params.id, vanData);
      if (!van) {
        return res.status(404).json({ error: "Van not found" });
      }
      res.json(van);
    } catch (error) {
      res.status(400).json({ error: "Failed to update van" });
    }
  });

  app.delete("/api/admin/vans/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const success = await storage.deleteVan(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Van not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete van" });
    }
  });

  // Fix ACLs for all van images
  app.post("/api/admin/vans/fix-acls", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const vans = await storage.getVans();
      let fixedCount = 0;
      let errorCount = 0;
      const objectStorageService = new ObjectStorageService();

      for (const van of vans) {
        const imagesToFix: string[] = [];
        
        if (van.heroImage) {
          imagesToFix.push(van.heroImage);
        }
        if (van.images && Array.isArray(van.images)) {
          imagesToFix.push(...van.images);
        }

        // Remove duplicates
        const uniqueImages = Array.from(new Set(imagesToFix));

        for (const imageUrl of uniqueImages) {
          if (imageUrl && imageUrl.includes('googleapis.com')) {
            // Retry mechanism for GCS eventual consistency
            let success = false;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                if (attempt > 0) {
                  await new Promise(resolve => setTimeout(resolve, 200 * attempt));
                }
                await objectStorageService.trySetObjectEntityAclPolicy(imageUrl, {
                  owner: 'system',
                  visibility: 'public'
                });
                fixedCount++;
                success = true;
                break;
              } catch (error: any) {
                if (attempt === 2) {
                  console.error(`Failed to set ACL for ${imageUrl} after 3 attempts:`, error.message);
                  errorCount++;
                }
              }
            }
          }
        }
      }

      res.json({ 
        success: true, 
        fixedCount, 
        errorCount,
        message: errorCount > 0 
          ? `Fixed ${fixedCount} images, ${errorCount} failed` 
          : `Fixed ${fixedCount} images successfully`
      });
    } catch (error) {
      console.error("Error fixing van image ACLs:", error);
      res.status(500).json({ error: "Failed to fix van image ACLs" });
    }
  });

  // Add image to van - NEW SIMPLIFIED VERSION
  app.post("/api/admin/vans/:id/images", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { imageUrl } = req.body;
      
      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({ error: "imageUrl is required" });
      }

      // Validate URL format
      if (!imageUrl.startsWith('https://storage.googleapis.com/')) {
        return res.status(400).json({ error: "Invalid image URL format" });
      }

      const van = await storage.getVan(req.params.id);
      if (!van) {
        return res.status(404).json({ error: "Van not found" });
      }

      // Add image URL to van images array
      const existingImages = van.images || [];
      const updatedImages = [...existingImages, imageUrl];
      
      const updatedVan = await storage.updateVan(req.params.id, {
        images: updatedImages,
        // If no hero image is set, use the first uploaded image
        ...((!van.heroImage && existingImages.length === 0) ? { heroImage: imageUrl } : {})
      });

      res.json(updatedVan);
    } catch (error) {
      console.error("Error adding van image:", error);
      res.status(500).json({ error: "Failed to add van image" });
    }
  });

  // Remove image from van
  app.delete("/api/admin/vans/:id/images", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { objectPath } = req.body;
      
      if (!objectPath) {
        return res.status(400).json({ error: "objectPath is required" });
      }

      const van = await storage.getVan(req.params.id);
      if (!van) {
        return res.status(404).json({ error: "Van not found" });
      }

      const existingImages = van.images || [];
      const updatedImages = existingImages.filter(img => img !== objectPath);
      
      // If removing the hero image, clear it or set to first remaining image
      const updatedHeroImage = van.heroImage === objectPath
        ? (updatedImages.length > 0 ? updatedImages[0] : undefined)
        : van.heroImage;
      
      const updatedVan = await storage.updateVan(req.params.id, {
        images: updatedImages,
        heroImage: updatedHeroImage
      });

      res.json(updatedVan);
    } catch (error) {
      console.error("Error removing van image:", error);
      res.status(500).json({ error: "Failed to remove van image" });
    }
  });

  // Set van hero image
  app.put("/api/admin/vans/:id/hero-image", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { objectPath } = req.body;
      
      if (!objectPath) {
        return res.status(400).json({ error: "objectPath is required" });
      }

      const van = await storage.getVan(req.params.id);
      if (!van) {
        return res.status(404).json({ error: "Van not found" });
      }

      // Verify the image is in the van's images array
      const existingImages = van.images || [];
      if (!existingImages.includes(objectPath)) {
        return res.status(400).json({ error: "Image not found in van's image gallery" });
      }
      
      const updatedVan = await storage.updateVan(req.params.id, {
        heroImage: objectPath
      });

      res.json(updatedVan);
    } catch (error) {
      console.error("Error setting hero image:", error);
      res.status(500).json({ error: "Failed to set hero image" });
    }
  });

  // Reorder van images
  app.put("/api/admin/vans/:id/images/reorder", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { images } = req.body;
      
      if (!Array.isArray(images)) {
        return res.status(400).json({ error: "images array is required" });
      }

      const van = await storage.getVan(req.params.id);
      if (!van) {
        return res.status(404).json({ error: "Van not found" });
      }

      // Verify all images in the new order are from the van's existing images
      const existingImages = van.images || [];
      const allValid = images.every(img => existingImages.includes(img));
      
      if (!allValid || images.length !== existingImages.length) {
        return res.status(400).json({ error: "Invalid image order - images don't match van's gallery" });
      }
      
      const updatedVan = await storage.updateVan(req.params.id, {
        images: images
      });

      res.json(updatedVan);
    } catch (error) {
      console.error("Error reordering images:", error);
      res.status(500).json({ error: "Failed to reorder images" });
    }
  });

  // Helper: convert "FORD TRANSIT" to "Ford Transit"
  const toTitleCase = (str: string) =>
    str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  // Vehicle Registration Lookup (using Vehicle Data Global API)
  app.post("/api/admin/vehicle-lookup", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { registration } = req.body;

      if (!registration) {
        return res.status(400).json({ error: "Registration number is required" });
      }

      const apiKey = process.env.VEHICLE_LOOKUP_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "VEHICLE_LOOKUP_API_KEY not configured — please add it in secrets" });
      }

      // Clean registration (remove spaces, uppercase)
      const cleanReg = registration.replace(/\s+/g, '').toUpperCase();
      console.log('[vehicle-lookup] Looking up registration:', cleanReg);

      // Call Vehicle Data Global API — VehicleDetails package returns make, model, fuel, engine, wheelbase, colour
      const vdgUrl = `https://uk.api.vehicledataglobal.com/r2/lookup?ApiKey=${apiKey}&PackageName=VehicleDetails&Vrm=${encodeURIComponent(cleanReg)}`;
      const vdgResponse = await fetch(vdgUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const vdgText = await vdgResponse.text();
      console.log(`[vehicle-lookup] VDG HTTP ${vdgResponse.status}:`, vdgText.slice(0, 300));

      if (!vdgResponse.ok) {
        return res.status(404).json({ error: `Vehicle lookup failed (${vdgResponse.status}). Please enter the details manually.` });
      }

      let vdgData: any;
      try {
        vdgData = JSON.parse(vdgText);
      } catch {
        return res.status(500).json({ error: "Unexpected response from vehicle data provider. Please enter the details manually." });
      }

      // Check API-level success
      const responseInfo = vdgData.ResponseInformation || {};
      if (!responseInfo.IsSuccessStatusCode) {
        const msg = responseInfo.StatusMessage || 'Vehicle not found';
        console.warn('[vehicle-lookup] VDG non-success:', msg);
        return res.status(404).json({ error: `Vehicle not found: ${msg}. Please check the registration.` });
      }

      const results = vdgData.Results || {};
      const vd = results.VehicleDetails || {};
      const md = results.ModelDetails || {};

      // Vehicle identification — prefer ModelDetails (better formatted)
      const make = md.ModelIdentification?.Make || toTitleCase(vd.VehicleIdentification?.DvlaMake || '');
      const model = md.ModelIdentification?.Model || toTitleCase(vd.VehicleIdentification?.DvlaModel || '');
      const year = vd.VehicleIdentification?.YearOfManufacture || new Date().getFullYear();

      // Colour
      const colourRaw = vd.VehicleHistory?.ColourDetails?.CurrentColour || '';
      const colour = toTitleCase(colourRaw);

      // Fuel type — prefer ModelDetails (already human-readable)
      const fuelMd = md.Powertrain?.FuelType || '';
      const fuelDvla = (vd.VehicleIdentification?.DvlaFuelType || '').toUpperCase();
      const fuel = fuelMd || (
        fuelDvla.includes('OIL') || fuelDvla === 'DIESEL' ? 'Diesel'
        : fuelDvla === 'PETROL' ? 'Petrol'
        : fuelDvla.includes('ELECTRIC') ? 'Electric'
        : fuelDvla.includes('HYBRID') ? 'Hybrid'
        : 'Diesel'
      );

      // Engine — use description from ModelDetails, fallback to cc
      const engineDesc = md.Powertrain?.IceDetails?.EngineDescription || '';
      const engineCC = vd.DvlaTechnicalDetails?.EngineCapacityCc || 0;
      const engine = engineDesc || (engineCC > 0 ? `${(engineCC / 1000).toFixed(1)}L` : '');

      // Van size from wheelbase type
      const wheelbaseType = (md.BodyDetails?.WheelbaseType || '').toLowerCase();
      const vanSize = wheelbaseType.includes('short') ? 'SWB'
        : wheelbaseType.includes('long') ? 'LWB'
        : wheelbaseType.includes('medium') ? 'MWB'
        : 'MWB';

      const vanData = {
        registration: cleanReg,
        make,
        model,
        year,
        colour,
        specs: {
          transmission: 'Manual',
          fuel,
          size: vanSize,
          engine,
        },
        title: `${year} ${make} ${model}`.trim(),
      };

      console.log('[vehicle-lookup] Success:', JSON.stringify(vanData, null, 2));
      res.json(vanData);
    } catch (error) {
      console.error("Error looking up vehicle:", error);
      res.status(500).json({ error: "Failed to lookup vehicle" });
    }
  });

  // AI Description Generator for Vans (using OpenAI via Replit AI Integrations)
  app.post("/api/admin/generate-van-description", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { make, model, year, transmission, size, fuel, mileage, engine } = req.body;

      if (!make || !model || !year) {
        return res.status(400).json({ error: "Make, model, and year are required" });
      }

      // Import OpenAI SDK
      const OpenAI = (await import('openai')).default;

      // Initialize OpenAI client with Replit AI Integrations
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      // Build context string from van details
      const vanDetails = [
        `${year} ${make} ${model}`,
        size ? `${size} (${size === 'SWB' ? 'Short Wheel Base' : size === 'MWB' ? 'Medium Wheel Base' : 'Long Wheel Base'})` : '',
        transmission || '',
        fuel || '',
        mileage ? `${mileage.toLocaleString()} miles` : '',
        engine || '',
      ].filter(Boolean).join(' • ');

      // Create completion with mobile tyre van focus
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional automotive copywriter specializing in commercial vehicle sales for mobile tyre businesses. Your descriptions are concise, professional, and highlight practical benefits for mobile tyre fitting operations."
          },
          {
            role: "user",
            content: `Write a compelling sales description (2-3 paragraphs, around 150 words) for this van as a mobile tyre van:

${vanDetails}

Focus on:
- Spacious interior perfect for carrying tyre equipment and stock
- Reliability and build quality for daily mobile operations
- Professional appearance for customer visits
- Practical features that benefit mobile tyre fitting businesses
- Load capacity and accessibility

Keep it professional, concise, and sales-focused. Do not include pricing or warranty details.`
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const description = completion.choices[0]?.message?.content?.trim();

      if (!description) {
        throw new Error("No description generated");
      }

      res.json({ description });
    } catch (error) {
      console.error("Error generating description:", error);
      res.status(500).json({ error: "Failed to generate description" });
    }
  });

  // Admin CRUD endpoints for kits
  app.get("/api/admin/kits", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const kits = await storage.getKitsAdmin();
      res.json(kits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch kits" });
    }
  });

  // ── SKU utilities ─────────────────────────────────────────────────────────

  app.post("/api/admin/sku/generate", isFullAdmin, async (req, res) => {
    try {
      const { type } = z.object({ type: z.enum(["kit", "upgrade", "part"]) }).parse(req.body);
      const sku = await generateNextSku(type);
      res.json({ sku });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid type" });
      console.error("SKU generate:", err);
      res.status(500).json({ error: "Failed to generate SKU" });
    }
  });

  app.post("/api/admin/sku/import-cost-prices", isFullAdmin, async (req, res) => {
    try {
      const rows = req.body;
      if (!Array.isArray(rows)) {
        return res.status(400).json({ error: "Expected an array of rows" });
      }

      let updated = 0;
      let overwritten = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Load all kits and upgrades once (include cost_price to detect overwrites)
      const allKits = await pool.query(`SELECT id, sku, cost_price FROM kits`);
      const allUpgrades = await pool.query(`SELECT id, sku, cost_price FROM upgrades`);

      // Build lookup maps: sku (normalised) → { id, hasCostPrice }, and id → hasCostPrice
      const kitBySku = new Map<string, { id: string; hasCostPrice: boolean }>();
      const kitById = new Map<string, boolean>();
      for (const row of allKits.rows) {
        const hasCostPrice = row.cost_price !== null && row.cost_price !== undefined;
        if (row.sku) kitBySku.set(row.sku.trim().toLowerCase(), { id: row.id, hasCostPrice });
        kitById.set(row.id, hasCostPrice);
      }
      const upgradeBySku = new Map<string, { id: string; hasCostPrice: boolean }>();
      const upgradeById = new Map<string, boolean>();
      for (const row of allUpgrades.rows) {
        const hasCostPrice = row.cost_price !== null && row.cost_price !== undefined;
        if (row.sku) upgradeBySku.set(row.sku.trim().toLowerCase(), { id: row.id, hasCostPrice });
        upgradeById.set(row.id, hasCostPrice);
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rawIdentifier = String(row.identifier ?? "").trim();
        const rawPrice = row.costPrice;

        if (!rawIdentifier) {
          skipped++;
          continue;
        }

        // costPrice is in pence (integer) — already converted by client
        const pence = typeof rawPrice === "number" && isFinite(rawPrice) ? Math.round(rawPrice) : null;
        if (pence === null) {
          errors.push(`Row ${i + 1}: invalid cost price "${rawPrice}"`);
          skipped++;
          continue;
        }

        const identifierLower = rawIdentifier.toLowerCase();

        // Try kit by SKU first, then by ID
        let matched = false;
        if (kitBySku.has(identifierLower)) {
          const entry = kitBySku.get(identifierLower)!;
          await pool.query(`UPDATE kits SET cost_price = $1 WHERE id = $2`, [pence, entry.id]);
          entry.hasCostPrice ? overwritten++ : updated++;
          entry.hasCostPrice = true; // mark so duplicate rows in same CSV count as overwrites
          kitById.set(entry.id, true);
          matched = true;
        } else if (kitById.has(rawIdentifier)) {
          const hasCostPrice = kitById.get(rawIdentifier)!;
          await pool.query(`UPDATE kits SET cost_price = $1 WHERE id = $2`, [pence, rawIdentifier]);
          hasCostPrice ? overwritten++ : updated++;
          kitById.set(rawIdentifier, true);
          matched = true;
        }

        if (!matched) {
          // Try upgrade by SKU first, then by ID
          if (upgradeBySku.has(identifierLower)) {
            const entry = upgradeBySku.get(identifierLower)!;
            await pool.query(`UPDATE upgrades SET cost_price = $1 WHERE id = $2`, [pence, entry.id]);
            entry.hasCostPrice ? overwritten++ : updated++;
            entry.hasCostPrice = true; // mark so duplicate rows in same CSV count as overwrites
            upgradeById.set(entry.id, true);
            matched = true;
          } else if (upgradeById.has(rawIdentifier)) {
            const hasCostPrice = upgradeById.get(rawIdentifier)!;
            await pool.query(`UPDATE upgrades SET cost_price = $1 WHERE id = $2`, [pence, rawIdentifier]);
            hasCostPrice ? overwritten++ : updated++;
            upgradeById.set(rawIdentifier, true);
            matched = true;
          }
        }

        if (!matched) {
          errors.push(`Row ${i + 1}: no kit or upgrade found for "${rawIdentifier}"`);
          skipped++;
        }
      }

      res.json({ ok: true, updated, overwritten, skipped, errors });
    } catch (err) {
      console.error("Cost price import:", err);
      res.status(500).json({ error: "Failed to import cost prices" });
    }
  });

  app.get("/api/admin/sku/cost-price-template", isFullAdmin, async (req, res) => {
    try {
      const kits = await pool.query(
        `SELECT sku, name FROM kits WHERE sku IS NOT NULL AND sku <> '' ORDER BY name`
      );
      const upgrades = await pool.query(
        `SELECT sku, name FROM upgrades WHERE sku IS NOT NULL AND sku <> '' ORDER BY name`
      );

      const rows: Array<{ sku: string; name: string }> = [
        ...kits.rows,
        ...upgrades.rows,
      ];

      const escape = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;

      let csv = "SKU,Item Name,Cost Price (£)\r\n";
      for (const row of rows) {
        csv += `${escape(row.sku)},${escape(row.name)},\r\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="cost-price-template.csv"'
      );
      res.send(csv);
    } catch (err) {
      console.error("Cost price template:", err);
      res.status(500).json({ error: "Failed to generate template" });
    }
  });

  app.post("/api/admin/sku/backfill", isFullAdmin, async (req, res) => {
    try {
      let count = 0;
      // Backfill kits missing a SKU
      const missingKits = await pool.query(`SELECT id FROM kits WHERE sku IS NULL OR sku = ''`);
      for (const row of missingKits.rows) {
        const sku = await generateNextSku('kit');
        await pool.query(`UPDATE kits SET sku = $1 WHERE id = $2`, [sku, row.id]);
        count++;
      }
      // Backfill upgrades missing a SKU (skip parent groups: no parentId + price=0)
      const missingUpgrades = await pool.query(
        `SELECT id, price, parent_id FROM upgrades WHERE (sku IS NULL OR sku = '') AND NOT (parent_id IS NULL AND price = 0)`
      );
      for (const row of missingUpgrades.rows) {
        const sku = await generateNextSku('upgrade');
        await pool.query(`UPDATE upgrades SET sku = $1 WHERE id = $2`, [sku, row.id]);
        count++;
      }
      res.json({ ok: true, assigned: count });
    } catch (err) {
      console.error("SKU backfill:", err);
      res.status(500).json({ error: "Failed to backfill SKUs" });
    }
  });

  // ── AutoTradeOS: catalogue sync push ───────────────────────────────────────
  app.post("/api/admin/sku-sync/push", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const apiUrl = process.env.AUTOTRADEOS_API_URL;
      const apiKey = process.env.AUTOTRADE_OS_API_KEY;
      if (!apiUrl || !apiKey) {
        return res.status(500).json({ error: "AutoTradeOS integration not configured — set AUTOTRADEOS_API_URL and AUTOTRADE_OS_API_KEY in secrets" });
      }

      const kitsResult = await pool.query(
        `SELECT id, name, sku, price, cost_price, sku_components FROM kits WHERE published = true`
      );
      const upgradesResult = await pool.query(
        `SELECT id, name, sku, price, cost_price, sku_components FROM upgrades WHERE published = true AND sku IS NOT NULL AND sku <> ''`
      );

      interface CatalogueBomEntry {
        sku: string;
        description: string;
        quantity: number;
        cost_price_pence: number;
      }
      interface CatalogueItem {
        sku: string;
        name: string;
        type: "kit" | "upgrade";
        sell_price_pence: number;
        cost_price_pence: number;
        bom: CatalogueBomEntry[];
      }
      interface AutoTradeOsReceiveResponse {
        ok: boolean;
        items_received?: number;
      }

      // SkuComponent rows stored in JSON: { sku, description, quantity, costPrice? }
      type StoredBomComponent = { sku: string; description: string; quantity: number; costPrice?: number | null };

      function parseBom(raw: unknown): StoredBomComponent[] {
        if (Array.isArray(raw)) return raw as StoredBomComponent[];
        if (typeof raw === "string" && raw) {
          try { return JSON.parse(raw) as StoredBomComponent[]; } catch { /* fall through */ }
        }
        return [];
      }

      const items: CatalogueItem[] = [];

      for (const kit of kitsResult.rows) {
        if (!kit.sku) continue;
        items.push({
          sku: kit.sku as string,
          name: kit.name as string,
          type: "kit",
          sell_price_pence: (kit.price as number) ?? 0,
          cost_price_pence: (kit.cost_price as number) ?? 0,
          bom: parseBom(kit.sku_components).map(c => ({
            sku: c.sku,
            description: c.description,
            quantity: c.quantity,
            cost_price_pence: c.costPrice ?? 0,
          })),
        });
      }

      for (const upg of upgradesResult.rows) {
        if (!upg.sku) continue;
        items.push({
          sku: upg.sku as string,
          name: upg.name as string,
          type: "upgrade",
          sell_price_pence: (upg.price as number) ?? 0,
          cost_price_pence: (upg.cost_price as number) ?? 0,
          bom: parseBom(upg.sku_components).map(c => ({
            sku: c.sku,
            description: c.description,
            quantity: c.quantity,
            cost_price_pence: c.costPrice ?? 0,
          })),
        });
      }

      const syncedAt = new Date().toISOString();
      const payload = { source: "mtv", synced_at: syncedAt, items };
      const endpointUrl = `${apiUrl}/api/mtv/receive-catalogue`;

      const atResponse = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(payload),
      });

      if (!atResponse.ok) {
        const text = await atResponse.text();
        console.error(`AutoTradeOS catalogue sync failed: ${atResponse.status}`, text);
        return res.status(502).json({ error: `AutoTradeOS returned HTTP ${atResponse.status}` });
      }

      const atResult = await atResponse.json() as AutoTradeOsReceiveResponse;
      await storage.setSiteSetting("sku_catalogue_last_sync", syncedAt);

      res.json({ ok: true, items_sent: items.length, autotradeos_response: atResult, synced_at: syncedAt });
    } catch (err) {
      console.error("SKU catalogue sync error:", err);
      res.status(500).json({ error: "Failed to sync catalogue to AutoTradeOS" });
    }
  });

  // ── AutoTradeOS: stock levels read (admin) ──────────────────────────────────
  app.get("/api/admin/sku-stock", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT sku, stock_qty, updated_at FROM sku_stock_levels`
      );
      const map: Record<string, { stockQty: number; updatedAt: string }> = {};
      for (const row of result.rows) {
        map[row.sku] = { stockQty: row.stock_qty, updatedAt: row.updated_at };
      }
      res.json(map);
    } catch (err) {
      console.error("SKU stock read error:", err);
      res.status(500).json({ error: "Failed to read stock levels" });
    }
  });

  // ── Equipment Packs ────────────────────────────────────────────────────────

  app.post("/api/admin/kits", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🛠️ Kit creation request:', {
          body: req.body,
          userId: req.session.user?.id
        });
      }
      
      const kitData = insertKitSchema.parse(req.body);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Kit validation passed:', kitData);
      }

      // Auto-assign SKU if not provided
      if (!kitData.sku) {
        kitData.sku = await generateNextSku('kit');
      }

      const kit = await storage.createKit(kitData);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Kit created:', kit);
      }
      
      res.json(kit);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Kit creation failed:', error);
      }
      res.status(400).json({ error: "Failed to create kit" });
    }
  });

  app.put("/api/admin/kits/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const kitData = insertKitSchema.partial().parse(req.body);
      // General form save must never wipe an existing BOM — only the dedicated
      // SKU Manager PATCH endpoint is allowed to set skuComponents to null.
      if (kitData.skuComponents === null || kitData.skuComponents === undefined) {
        delete (kitData as any).skuComponents;
      }
      const kit = await storage.updateKit(req.params.id, kitData);
      if (!kit) {
        return res.status(404).json({ error: "Kit not found" });
      }
      res.json(kit);
    } catch (error) {
      res.status(400).json({ error: "Failed to update kit" });
    }
  });

  // PATCH is an alias for PUT — allows partial updates (used by SKU Manager)
  app.patch("/api/admin/kits/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const kitData = insertKitSchema.partial().parse(req.body);
      const kit = await storage.updateKit(req.params.id, kitData);
      if (!kit) {
        return res.status(404).json({ error: "Kit not found" });
      }
      res.json(kit);
    } catch (error) {
      res.status(400).json({ error: "Failed to update kit" });
    }
  });

  app.delete("/api/admin/kits/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const success = await storage.deleteKit(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Kit not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete kit" });
    }
  });

  // Update kit sort order
  app.patch("/api/admin/kits/:id/sort-order", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { sortOrder } = req.body;
      
      if (typeof sortOrder !== 'number') {
        return res.status(400).json({ error: "sortOrder must be a number" });
      }
      
      const kit = await storage.updateKit(req.params.id, { sortOrder });
      if (!kit) {
        return res.status(404).json({ error: "Kit not found" });
      }
      res.json(kit);
    } catch (error) {
      res.status(500).json({ error: "Failed to update sort order" });
    }
  });

  // ── AutoTradeOS: push build parts to warehouse ────────────────────────────
  app.post("/api/admin/autotrade/push-build", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { quoteId } = req.body;
      if (!quoteId || typeof quoteId !== "string") {
        return res.status(400).json({ error: "quoteId is required" });
      }

      const quote = await storage.getQuote(quoteId);
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      const kit = (quote as any).kitId ? await storage.getKit((quote as any).kitId) : null;
      const allUpgrades = await storage.getAllUpgradesAdmin();
      const selectedUpgrades = allUpgrades.filter((u) =>
        ((quote as any).selectedUpgradeIds || []).includes(u.id)
      );

      type Part = { sku: string; description: string; quantity: number; source_item: string };
      const parts: Part[] = [];

      const expandItem = (
        name: string,
        sku: string | null | undefined,
        bom: Array<{ sku: string; description: string; quantity: number }> | null | undefined,
        qty: number = 1
      ) => {
        if (bom && bom.length > 0) {
          for (const comp of bom) {
            if (comp.sku) {
              parts.push({
                sku: comp.sku,
                description: comp.description || comp.sku,
                quantity: (comp.quantity || 1) * qty,
                source_item: name,
              });
            }
          }
        } else if (sku) {
          parts.push({ sku, description: name, quantity: qty, source_item: name });
        }
        // items with neither SKU nor BOM are skipped (pre-flight warns about these)
      };

      if (kit) {
        expandItem(kit.name, (kit as any).sku, (kit as any).skuComponents);
      }
      for (const u of selectedUpgrades) {
        const qty = (quote as any).upgradeQuantities?.[u.id] ?? 1;
        expandItem(u.name, (u as any).sku, (u as any).skuComponents, qty);
      }

      const pushedBy = (req as any).user?.username || "admin";
      const payload = {
        source: "mtv",
        quote_id: quoteId,
        van_ref: (quote as any).vanRegistration || (quote as any).vanId || "",
        customer_name: (quote as any).userName,
        pushed_by: pushedBy,
        pushed_at: new Date().toISOString(),
        parts,
      };

      const apiUrl = process.env.AUTOTRADEOS_API_URL;
      // Support both naming conventions for the API key
      const apiKey = process.env.AUTOTRADE_OS_API_KEY || process.env.AUTOTRADEOS_SYNC_KEY;
      if (!apiUrl || !apiKey) {
        return res.status(500).json({ error: "AutoTradeOS integration not configured — set AUTOTRADEOS_API_URL and AUTOTRADE_OS_API_KEY in secrets" });
      }

      // Full endpoint URL can be overridden via AUTOTRADEOS_ENDPOINT_URL;
      // defaults to the base URL + the standard receive-build path
      const endpointUrl = process.env.AUTOTRADEOS_ENDPOINT_URL || `${apiUrl}/api/admin/autotrade/receive-build`;

      const atResponse = await fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify(payload),
      });

      if (!atResponse.ok) {
        const text = await atResponse.text().catch(() => "");
        console.error(`AutoTradeOS push failed: ${atResponse.status}`, text);
        return res.status(502).json({ error: `AutoTradeOS returned HTTP ${atResponse.status}` });
      }

      const result = await atResponse.json();

      // Atomically append a push log entry using a single UPDATE with jsonb concatenation
      // This avoids the race condition that a read-modify-write approach would have when
      // two staff members push the same quote concurrently.
      try {
        const newEntry: {
          pushed_at: string;
          pushed_by: string;
          build_job_id?: string;
          parts_received?: number;
        } = {
          pushed_at: payload.pushed_at,
          pushed_by: pushedBy,
          ...(result.build_job_id ? { build_job_id: result.build_job_id } : {}),
          ...(typeof result.parts_received === "number" ? { parts_received: result.parts_received } : {}),
        };

        await pool.query(
          `UPDATE quotes
              SET autotrade_pushes = COALESCE(autotrade_pushes, '[]'::jsonb) || $1::jsonb
            WHERE id = $2`,
          [JSON.stringify([newEntry]), quoteId]
        );
      } catch (logErr) {
        console.error("AutoTradeOS: failed to persist push log entry:", logErr);
        // Non-fatal — push itself succeeded; don't fail the response over logging
      }

      res.json(result);
    } catch (error: any) {
      console.error("AutoTradeOS push error:", error);
      res.status(500).json({ error: "Failed to push build to AutoTradeOS" });
    }
  });

  // ── Admin Help AI Agent ───────────────────────────────────────────────────
  app.post("/api/admin/help", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { messages } = req.body as {
        messages: Array<{ role: "user" | "assistant"; content: string }>;
      };

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array required" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const systemPrompt = `You are the ${BRAND.initials} Admin Assistant — an expert help agent embedded directly inside the ${BRAND.name} admin panel. You help staff use every feature of the system confidently.

Your style: concise, practical, direct. Answer "how do I…" questions with clear numbered steps and exact menu names. Never waffle. If you're unsure, say so.

═══════════════════════════════════════════════════════════
FULL ADMIN SYSTEM KNOWLEDGE BASE
═══════════════════════════════════════════════════════════

## NAVIGATION
The sidebar has two sections:
1. CRM: Dashboard · Admin Configurator · Finance Calculator · Customers · Quote Requests · Leads · AI Conversations · Calendar · Analytics
2. Content: Vans · Packs · Upgrades · SKU Manager · Finance Plans · Training · Gallery · Videos · Blog · AI Packages · Max AI Settings · Users · Email Templates · Settings

---

## VANS
Path: Admin → Vans

- Click "Add Van" to create a new van.
- Enter a UK reg plate and click "Look Up" — it auto-fills make, model, year, mileage, engine size, fuel, and transmission via the vehicle lookup API.
- Required fields: registration, make, model, year, mileage, price (ex-VAT), van size (SWB/MWB/LWB).
- Toggle "Published" to make the van visible on the public stock page.
- Upload images via the image uploader on the van form — first image becomes the hero.
- To edit: click the pencil (✏) icon on the van row.
- To delete: click the trash (🗑) icon. This removes the van from the system permanently.
- Van slugs are auto-generated from the registration plate and used in public URLs.
- Each van has a "Stock Build" toggle — when enabled, a QR code can be linked to the van's build progress page.

---

## PACKS (EQUIPMENT KITS)
Path: Admin → Packs

- Packs are complete tyre fitting equipment bundles (e.g. "Pack 1 – Non-Euro 6 T1000").
- Click "Create Pack" to add a new pack.
- Fields: name, description, price (ex-VAT), size compatibility (SWB/MWB/LWB/all), service type, power output (kW), dimensions, weight, "includes" bullet-point list.
- Each pack can have a SKU (for AutoTradeOS) and a Bill of Materials (list of component parts).
- Upload a hero image for the pack — it appears in the configurator.
- Toggle "Published" to show/hide in the configurator.
- Packs appear in Step 2 of the customer configurator ("Choose Your Pack").
- To edit: click the pencil icon. To delete: click the trash icon (only if no active quotes reference it).

---

## UPGRADES & OPTIONS
Path: Admin → Upgrades

Upgrades are optional add-ons customers can select after choosing a pack.

**Types of upgrades:**
- Simple upgrade: standalone item with its own SKU and BOM (e.g. "3000W Inverter").
- Parent group: display header for a group of variants (e.g. "Accessories"). Has NO SKU — it's just a label.
- Variant child: one specific option within a group (e.g. "Pack 1 – Maxi Euro 8"). Each variant has its own SKU and BOM.

**Creating an upgrade:**
1. Click "Add Upgrade".
2. Fill in: name, category, description, price (ex-VAT).
3. For a variant child: set "Parent Group" to the parent upgrade.
4. Set "Published" to show it in the configurator.
5. Set "Sort Order" — lower numbers appear first.
6. Add a SKU and Bill of Materials in the SKU/BOM section.

**Mutually exclusive rules (enforced automatically):**
- PTO Air System and Electric Start Compressor cannot both be selected.
- Full Wrap, Half Wrap, and Graphic Pack are mutually exclusive branding options.

**Categories used in the configurator:** Air Systems · Electrics · Accessories · Branding · Storage · Safety · Lighting · Miscellaneous

**Image gallery:** Each upgrade can have multiple images — displayed as a carousel in the configurator.

---

## SKU MANAGER
Path: Admin → SKU Manager

Gives a hierarchical overview of all SKUs and Bills of Materials across packs and upgrades.

**Layout:**
- Equipment Packs section: all packs listed flat with their SKU status.
- Upgrades section: parent groups shown greyed-out with "Group — see variants" badge (no SKU needed). Variant children shown indented under their parent. Simple upgrades shown flat.

**Editing:**
- Inline SKU field: click, type the SKU code, press Enter or click away to save instantly.
- "Edit BOM" / "Add BOM" button: opens a dialog to manage component parts (Part SKU, Description, Quantity). Rows can be reordered with the ↑ ↓ buttons.

**Warning badges:** Items missing a SKU show an amber "No SKU" badge — these will be flagged in the AutoTradeOS pre-flight check.

---

## QUOTE REQUESTS
Path: Admin → Quote Requests

**Quote statuses (in order):**
new → contacted → awaiting_deposit → awaiting_finance → deposit_taken → finance_approved → in_build → completed → cancelled

**Actions on the quotes list:**
- Quick action buttons change status with one click.
- Click a quote row to open the full detail view.
- Filter by status using the tabs at the top.

**Inside a quote detail:**
- Change the van: click "Edit" in the Van section, search by reg or name.
- Change the pack: click "Edit" in the Pack section.
- Edit equipment: click "Edit Equipment" — opens a categorised equipment editor with quantity controls.
- Apply a discount: enter a percentage or fixed amount in the Discount section.
- Add internal notes in the "Admin Notes" field.
- Assign a staff member from the dropdown.
- Finance section: shows HP/lease monthly payments calculated from current total.
- Status buttons: use the coloured quick-action buttons or the manual status dropdown.

**Full admin only:**
- "Send Confirmation Email" — generates a secure one-time link and emails the customer.
- "Delete Quote" — permanently removes the quote (use with caution).

---

## BUILD SHEETS
Path: From a quote detail page → click "Build Sheet"

- Internal technician document — shows full van spec, pack details, all upgrades with quantities and serial numbers.
- Pricing is NOT shown (build sheet is for technicians, not accounting).
- Supersession rules: if an upgrade replaces standard kit items, those items are crossed off on the sheet.
- Click "Print" for a printer-friendly PDF-ready layout.

**AutoTradeOS Push (full admin only):**
1. Open the build sheet for a quote.
2. Click "Push to AutoTradeOS" — the button runs a pre-flight check.
3. Pre-flight: warns if any selected items are missing a SKU. Shows "X of Y items have no SKU".
4. Click "Push Now" to send the parts list to the AutoTradeOS warehouse API.
5. Result shows: build job ID, number of parts received, any low-stock warnings.

---

## LEADS
Path: Admin → Leads

Leads are enquiries from the public contact form or AI chat.

- Each lead shows: name, email, phone, company, van type interested in, message, and timestamp.
- Status: new · contacted · converted · closed.
- Change status with the quick-action buttons.
- Click a lead to see full details and add notes.
- "Convert to Quote" creates a new quote draft linked to this lead.
- Leads are automatically linked to a Customer record (matched by email).

---

## CUSTOMERS
Path: Admin → Customers

The customer database aggregates all interactions (leads, quotes, AI conversations) per person.

- Search by name, email, or phone.
- Click a customer to open their profile — shows all their quotes, leads, conversations, and notes.
- Add notes via the "Add Note" button on the profile page.
- "Merge Customer" — if duplicates exist, merge them into one record.
- New customer badges appear on the sidebar counter.

---

## AI CONVERSATIONS
Path: Admin → AI Conversations

Conversations that happened with "Max" — the public AI van builder assistant.

- Shows: customer name, phone, email, conversation stage, mapped van configuration.
- Status: active · completed · abandoned.
- Completed conversations automatically create a quote draft.
- Click a conversation to see the full chat history and the mapped configuration.
- "Mark Contacted" records when staff have followed up.

---

## CALENDAR
Path: Admin → Calendar

- Shows scheduled follow-up tasks linked to customers and quotes.
- A "Today's Follow-ups" modal auto-appears on login if tasks are due today.
- Add follow-ups from inside a customer profile or quote detail.

---

## ANALYTICS
Path: Admin → Analytics

- Shows: pageviews, unique sessions, quote conversion rate, revenue pipeline by status.
- Date-range filter at the top.
- Staff performance section shows quote counts per assigned admin.

---

## FINANCE PLANS
Path: Admin → Finance Plans

- Manage Hire Purchase (HP) and Lease finance options.
- Each plan: name, type (hp/lease), APR (%), term in months, deposit percentage, balloon payment.
- Plans appear in Step 4 of the customer configurator and in quote detail finance calculations.
- Toggle "Active" to show/hide a plan.

---

## TRAINING OPTIONS
Path: Admin → Training

- Manage training certifications offered with van purchases.
- Options include REACT (motorway tyre changing) and standard Tyre Fitting certification.
- Shown in Step 3 of the customer configurator.

---

## GALLERY
Path: Admin → Gallery

- Manage portfolio images and videos of completed builds.
- Each item: title, description, media URL, category, published status, sort order.
- Toggle "Published" to control public visibility.
- "Featured" toggle highlights an item at the top of the gallery page.
- Drag sort order to reorder (or set sort order number manually).

---

## VIDEOS
Path: Admin → Videos

- Manage promotional video content.
- Videos are served from object storage or external URLs.

---

## BLOG
Path: Admin → Blog

- Create and manage blog articles.
- Each post: title, slug, content (rich text), excerpt, published status, date.
- Published posts appear on the public /blog page.

---

## USERS & ACCESS LEVELS
Path: Admin → Users (full admin only)

Three admin roles:
- **None**: Regular user — no admin access, redirected to homepage.
- **Basic Admin**: Access to CRM features — Quote Requests, Leads, AI Conversations, Customers, Dashboard, Calendar, Analytics, Admin Configurator, Finance Calculator, Build Sheets.
- **Full Admin**: Complete access — everything in Basic plus Inventory (Vans, Packs, Upgrades, Finance Plans, Training, Gallery, Videos, Blog, SKU Manager), Users, Settings, Email Templates, and privileged quote actions (send emails, delete quotes, AutoTradeOS push).

To change a user's role: click the edit icon on their row → change the Role dropdown → save.

---

## ADMIN CONFIGURATOR
Path: Admin → Admin Configurator

- Lets staff build a quote on behalf of a customer using the same configurator flow.
- Steps: Select Van → Select Pack → Select Upgrades → Select Training → Select Finance → Enter Customer Details → Submit.
- The resulting quote appears in Quote Requests immediately.
- Use this when a customer calls in and wants to be quoted by phone.

---

## FINANCE CALCULATOR
Path: Admin → Finance Calculator

- Ad-hoc finance calculator — enter a total price to see HP/lease monthly payments.
- Useful for quick phone quotes.
- Uses the active finance plans from Admin → Finance Plans.

---

## SETTINGS
Path: Admin → Settings

- Hero video URL — the video shown on the public homepage.
- Business contact details (phone, email, address).
- Feature toggles (e.g. enable/disable public AI chat).
- Site-wide messaging and legal links.

---

## MAX AI SETTINGS
Path: Admin → Max AI Settings

- Configure "Max" — the public-facing AI van builder assistant.
- "Business Context" text block: add business-specific rules, special offers, or FAQs that Max incorporates into conversations.
- Max uses GPT-4o and engages customers in a guided conversation to select their van, pack, upgrades, training, and finance.

---

## EMAIL TEMPLATES
Path: Admin → Email Templates

- Preview the HTML quote confirmation email that customers receive.
- The email includes a secure, one-time confirmation link.
- To send the email: go to a quote detail → click "Send Confirmation Email" (full admin only).
- The "from" address is configured via the MAIL_FROM environment variable.

---

## AI PACKAGES
Path: Admin → AI Packages

- Manage pre-built equipment bundles that Max can recommend during AI conversations.
- Each package: name, description, tier, list of upgrade IDs.
- Max uses these to recommend suitable upgrade combinations based on customer needs.

═══════════════════════════════════════════════════════════
END OF KNOWLEDGE BASE
═══════════════════════════════════════════════════════════

Always refer the user to the exact admin menu path when describing a feature. Keep answers short and actionable.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 600,
        temperature: 0.3,
      });

      const reply = completion.choices[0]?.message?.content ?? "Sorry, I couldn't generate a response. Please try again.";
      res.json({ reply });
    } catch (error: any) {
      console.error("[admin-help] Error:", error);
      res.status(500).json({ error: "Failed to get help response" });
    }
  });

  // Admin CRUD endpoints for upgrades
  app.get("/api/admin/upgrades", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const upgrades = await storage.getAllUpgradesAdmin();
      res.json(upgrades);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch upgrades" });
    }
  });

  app.post("/api/admin/upgrades", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const upgradeData = insertUpgradeSchema.parse(req.body);
      
      // Validate pricing: parent upgrades (no parentId) must have price > 0 OR have children
      if (!upgradeData.parentId && upgradeData.price === 0) {
        // Check if this will have variant children by checking if it's referenced as a parent
        // For creation, we can't check existing children, so we must enforce price > 0
        // OR this validation happens after variants are created
        // For now, we'll allow 0 price only if this is explicitly a variant parent
        // The frontend should handle this, but we add a warning
        console.warn(`Creating upgrade ${upgradeData.name} with price 0 - assuming it will have variants`);
      }
      
      // Validate variant children must have price > 0
      if (upgradeData.parentId && upgradeData.price <= 0) {
        return res.status(400).json({ 
          error: "Variant upgrades must have a price greater than 0" 
        });
      }
      
      // Auto-assign SKU if not provided — skip parent groups (no parentId + price=0, just a label)
      const isParentGroup = !upgradeData.parentId && upgradeData.price === 0;
      if (!upgradeData.sku && !isParentGroup) {
        (upgradeData as any).sku = await generateNextSku('upgrade');
      }

      const upgrade = await storage.createUpgrade(upgradeData);
      res.json(upgrade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid upgrade data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to create upgrade" });
    }
  });

  app.put("/api/admin/upgrades/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const upgradeData = insertUpgradeSchema.partial().parse(req.body);
      
      // Validate variant children must have price > 0 if price is being updated
      if (upgradeData.parentId && upgradeData.price !== undefined && upgradeData.price <= 0) {
        return res.status(400).json({ 
          error: "Variant upgrades must have a price greater than 0" 
        });
      }

      // General form save must never wipe an existing BOM — only the dedicated
      // SKU Manager PATCH endpoint is allowed to set skuComponents to null.
      if (upgradeData.skuComponents === null || upgradeData.skuComponents === undefined) {
        delete (upgradeData as any).skuComponents;
      }
      
      const upgrade = await storage.updateUpgrade(req.params.id, upgradeData);
      if (!upgrade) {
        return res.status(404).json({ error: "Upgrade not found" });
      }
      res.json(upgrade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid upgrade data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update upgrade" });
    }
  });

  // PATCH is an alias for PUT — allows partial updates (used by SKU Manager)
  app.patch("/api/admin/upgrades/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const upgradeData = insertUpgradeSchema.partial().parse(req.body);
      const upgrade = await storage.updateUpgrade(req.params.id, upgradeData);
      if (!upgrade) {
        return res.status(404).json({ error: "Upgrade not found" });
      }
      res.json(upgrade);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid upgrade data", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update upgrade" });
    }
  });

  app.delete("/api/admin/upgrades/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      // Check if this upgrade has child variations
      const allUpgrades = await storage.getAllUpgradesAdmin();
      const hasChildren = allUpgrades.some(u => u.parentId === req.params.id);
      
      if (hasChildren) {
        return res.status(400).json({ 
          error: "Cannot delete equipment that has variations. Delete variations first." 
        });
      }
      
      const success = await storage.deleteUpgrade(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Upgrade not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete upgrade" });
    }
  });

  // Update upgrade sort order
  app.patch("/api/admin/upgrades/:id/sort-order", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { sortOrder } = req.body;
      
      if (typeof sortOrder !== 'number') {
        return res.status(400).json({ error: "sortOrder must be a number" });
      }
      
      const upgrade = await storage.updateUpgrade(req.params.id, { sortOrder });
      if (!upgrade) {
        return res.status(404).json({ error: "Upgrade not found" });
      }
      res.json(upgrade);
    } catch (error) {
      res.status(500).json({ error: "Failed to update sort order" });
    }
  });

  // Admin CRUD endpoints for finance plans
  app.get("/api/admin/finance-plans", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const plans = await storage.getFinancePlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch finance plans" });
    }
  });

  app.post("/api/admin/finance-plans", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const planData = insertFinancePlanSchema.parse(req.body);
      const plan = await storage.createFinancePlan(planData);
      res.json(plan);
    } catch (error) {
      res.status(400).json({ error: "Failed to create finance plan" });
    }
  });

  app.put("/api/admin/finance-plans/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const planData = insertFinancePlanSchema.partial().parse(req.body);
      const plan = await storage.updateFinancePlan(req.params.id, planData);
      if (!plan) {
        return res.status(404).json({ error: "Finance plan not found" });
      }
      res.json(plan);
    } catch (error) {
      res.status(400).json({ error: "Failed to update finance plan" });
    }
  });

  app.delete("/api/admin/finance-plans/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const success = await storage.deleteFinancePlan(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Finance plan not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete finance plan" });
    }
  });

  // Admin CRUD endpoints for training options
  app.get("/api/admin/training-options", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const options = await storage.getTrainingOptions();
      res.json(options);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch training options" });
    }
  });

  app.post("/api/admin/training-options", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const optionData = insertTrainingOptionSchema.parse(req.body);
      const option = await storage.createTrainingOption(optionData);
      res.json(option);
    } catch (error) {
      res.status(400).json({ error: "Failed to create training option" });
    }
  });

  app.put("/api/admin/training-options/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const optionData = insertTrainingOptionSchema.partial().parse(req.body);
      const option = await storage.updateTrainingOption(req.params.id, optionData);
      if (!option) {
        return res.status(404).json({ error: "Training option not found" });
      }
      res.json(option);
    } catch (error) {
      res.status(400).json({ error: "Failed to update training option" });
    }
  });

  app.delete("/api/admin/training-options/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteTrainingOption(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Training option not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete training option" });
    }
  });

  // Gallery Items - Admin endpoints
  function normalizeGalleryFileUrl(url: string): string {
    if (!url) return url;
    // Fix broken /objects/https:/ pattern created by old upload code
    // Note: browsers normalize /objects/https:// to /objects/https:/ (single slash)
    if (url.startsWith('/objects/https:') || url.startsWith('/objects/http:')) {
      // Restore the double-slash after the scheme so new URL() can parse it
      const rawGcs = url.replace(/^\/objects\//, '');
      const gcsUrl = rawGcs.replace(/^(https?):\/([^/])/, '$1://$2');
      try {
        const parsed = new URL(gcsUrl);
        const p = parsed.pathname;
        const productMatch = p.match(/\/product-images\/([^?]+)/);
        if (productMatch) return `/objects/product-images/${productMatch[1]}`;
        const vanMatch = p.match(/\/van-images\/([^?]+)/);
        if (vanMatch) return `/objects/van-images/${vanMatch[1]}`;
        const upgradeMatch = p.match(/\/upgrade-images\/([^?]+)/);
        if (upgradeMatch) return `/objects/upgrade-images/${upgradeMatch[1]}`;
        const videosMatch = p.match(/\/videos\/([^?]+)/);
        if (videosMatch) return `/objects/videos/${videosMatch[1]}`;
        const uploadsMatch = p.match(/\/uploads\/([^?]+)/);
        if (uploadsMatch) return `/objects/uploads/${uploadsMatch[1]}`;
      } catch {}
    }
    return url;
  }

  app.get("/api/admin/gallery-items", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const items = await storage.getGalleryItemsAdmin();
      const normalized = items.map(item => ({
        ...item,
        fileUrl: normalizeGalleryFileUrl(item.fileUrl),
        thumbnailUrl: item.thumbnailUrl ? normalizeGalleryFileUrl(item.thumbnailUrl) : item.thumbnailUrl,
      }));
      res.json(normalized);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch gallery items" });
    }
  });

  app.post("/api/admin/gallery-items", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const itemData = insertGalleryItemSchema.parse(req.body);
      const item = await storage.createGalleryItem(itemData);
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: "Failed to create gallery item" });
    }
  });

  app.put("/api/admin/gallery-items/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const itemData = insertGalleryItemSchema.partial().parse(req.body);
      const item = await storage.updateGalleryItem(req.params.id, itemData);
      if (!item) {
        return res.status(404).json({ error: "Gallery item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: "Failed to update gallery item" });
    }
  });

  app.delete("/api/admin/gallery-items/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteGalleryItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Gallery item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete gallery item" });
    }
  });

  // Gallery Items - Public endpoint
  app.get("/api/gallery-items", async (req, res) => {
    try {
      const items = await storage.getGalleryItems();
      const normalized = items.map(item => ({
        ...item,
        fileUrl: normalizeGalleryFileUrl(item.fileUrl),
        thumbnailUrl: item.thumbnailUrl ? normalizeGalleryFileUrl(item.thumbnailUrl) : item.thumbnailUrl,
      }));
      res.json(normalized);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch gallery items" });
    }
  });

  // Testimonials - Public endpoint (published only)
  app.get("/api/testimonials", async (_req, res) => {
    try {
      const items = await storage.getTestimonials();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch testimonials" });
    }
  });

  // Aggregate rating summary for published testimonials
  app.get("/api/testimonials/rating-summary", async (_req, res) => {
    try {
      const items = await storage.getTestimonials();
      const rated = items.filter(t => t.rating > 0);
      const count = rated.length;
      const averageRating = count > 0
        ? Math.round((rated.reduce((sum, t) => sum + t.rating, 0) / count) * 10) / 10
        : 0;
      res.json({ count, averageRating });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rating summary" });
    }
  });

  // Testimonials - Admin endpoints (GET is basic admin, write ops are full admin only)
  app.get("/api/admin/testimonials", isAuthenticated, isBasicAdmin, async (_req, res) => {
    try {
      const items = await storage.getTestimonialsAdmin();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch testimonials" });
    }
  });

  app.post("/api/admin/testimonials", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const data = insertTestimonialSchema.parse(req.body);
      const item = await storage.createTestimonial(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(400).json({ error: "Failed to create testimonial" });
    }
  });

  app.patch("/api/admin/testimonials/:id", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const data = insertTestimonialSchema.partial().parse(req.body);
      const item = await storage.updateTestimonial(req.params.id, data);
      if (!item) return res.status(404).json({ error: "Testimonial not found" });
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(400).json({ error: "Failed to update testimonial" });
    }
  });

  app.delete("/api/admin/testimonials/:id", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const success = await storage.deleteTestimonial(req.params.id);
      if (!success) return res.status(404).json({ error: "Testimonial not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete testimonial" });
    }
  });

  // Send testimonial request email to a customer
  app.post("/api/admin/testimonials/send-request", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { customerName, customerEmail } = req.body;
      if (!customerName || !customerEmail) {
        return res.status(400).json({ error: "customerName and customerEmail are required" });
      }
      const { randomBytes } = await import('crypto');
      const token = randomBytes(32).toString('hex');
      await storage.createTestimonialToken(token, customerName, customerEmail);
      const SITE_URL = brandSiteUrl();
      const reviewUrl = `${SITE_URL}/testimonial/${token}`;
      const { sendTestimonialRequestEmail } = await import('./email.js');
      await sendTestimonialRequestEmail({ to: customerEmail, customerName, reviewUrl });
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to send testimonial request:', error);
      res.status(500).json({ error: "Failed to send testimonial request email" });
    }
  });

  // Public: validate testimonial token
  app.get("/api/testimonial-request/:token", async (req, res) => {
    try {
      const record = await storage.getTestimonialToken(req.params.token);
      if (!record || record.usedAt) {
        return res.status(404).json({ valid: false });
      }
      res.json({ valid: true, customerName: record.customerName });
    } catch (error) {
      res.status(500).json({ error: "Failed to validate token" });
    }
  });

  // Public: submit testimonial via token
  app.post("/api/testimonial-request/:token", async (req, res) => {
    try {
      const record = await storage.getTestimonialToken(req.params.token);
      if (!record || record.usedAt) {
        return res.status(404).json({ error: "Invalid or already used link" });
      }
      const { name, company, location, content, rating } = req.body;
      if (!name || !company || !content || !rating) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      await storage.createTestimonial({
        name,
        company,
        location: location || null,
        content,
        rating: Number(rating),
        sortOrder: 0,
        published: false,
      });
      await storage.markTestimonialTokenUsed(req.params.token);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to submit testimonial:', error);
      res.status(500).json({ error: "Failed to submit testimonial" });
    }
  });

  // ─── Blog Posts (public) ──────────────────────────────────────────────────
  app.get("/api/blog-posts", async (_req, res) => {
    try {
      const posts = await storage.getBlogPosts();
      res.json(posts);
    } catch {
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.get("/api/blog-posts/:slug", async (req, res) => {
    try {
      const post = await storage.getBlogPostBySlug(req.params.slug);
      if (!post || !post.published) return res.status(404).json({ error: "Post not found" });
      res.json(post);
    } catch {
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  // ─── Blog Posts (admin) ───────────────────────────────────────────────────
  app.get("/api/admin/blog-posts", isAuthenticated, isFullAdmin, async (_req, res) => {
    try {
      const posts = await storage.getBlogPostsAdmin();
      res.json(posts);
    } catch {
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  app.post("/api/admin/blog-posts", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { insertBlogPostSchema } = await import("@shared/schema");
      const data = insertBlogPostSchema.parse(req.body);
      if (data.published && !data.publishedAt) {
        (data as any).publishedAt = new Date();
      }
      const post = await storage.createBlogPost(data);
      res.status(201).json(post);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to create blog post" });
    }
  });

  app.put("/api/admin/blog-posts/:id", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const existing = await storage.getBlogPost(req.params.id);
      if (!existing) return res.status(404).json({ error: "Post not found" });
      const updates = req.body;
      if (updates.published && !existing.publishedAt && !updates.publishedAt) {
        updates.publishedAt = new Date();
      }
      const post = await storage.updateBlogPost(req.params.id, updates);
      res.json(post);
    } catch (err: any) {
      res.status(400).json({ error: err.message || "Failed to update blog post" });
    }
  });

  app.delete("/api/admin/blog-posts/:id", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const ok = await storage.deleteBlogPost(req.params.id);
      if (!ok) return res.status(404).json({ error: "Post not found" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete blog post" });
    }
  });

  // ─── Blog: AI Auto-Generation ─────────────────────────────────────────────
  app.post("/api/admin/blog-posts/generate", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { keyword } = req.body || {};
      const post = await generateAiBlogPost(keyword || null);
      res.status(201).json(post);
    } catch (err: any) {
      console.error("[Blog AI] Generation failed:", err.message);
      res.status(500).json({ error: err.message || "AI generation failed" });
    }
  });

  // Customer portal endpoints
  app.get("/api/portal/quotes", isAuthenticated, async (req, res) => {
    try {
      const portalUser = await getCurrentUser(req);
      if (!portalUser) return res.status(401).json({ error: "Unauthorized" });
      const userQuotes = await storage.getQuotesByUserId(portalUser.id);
      res.json(userQuotes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch your quotes" });
    }
  });

  app.get("/api/portal/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.user?.id;
      const quote = await storage.getQuote(req.params.id);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Verify the quote belongs to the logged-in user
      if (quote.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.post("/api/portal/quotes/:id/approve-artwork", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.user?.id;
      const { approved, notes } = req.body;
      
      const quote = await storage.getQuote(req.params.id);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Verify the quote belongs to the logged-in user
      if (quote.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update artwork approval status
      const updated = await storage.updateQuote(req.params.id, {
        graphicsArtworkApproved: approved,
        graphicsArtworkNotes: notes || quote.graphicsArtworkNotes,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update artwork approval" });
    }
  });

  // Admin user management endpoints - commented out for now
  // Admin user is created automatically on startup

  // Admin endpoints for viewing quotes and leads
  app.get("/api/admin/quotes", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const quotes = await storage.getQuotes();
      // Collect unique customer IDs and fetch their names in one query
      const customerIds = [...new Set(quotes.map(q => q.customerId).filter(Boolean))] as string[];
      let customerNames: Record<string, string> = {};
      if (customerIds.length > 0) {
        const placeholders = customerIds.map((_, i) => `$${i + 1}`).join(", ");
        const { rows } = await pool.query<{ id: string; name: string }>(
          `SELECT id, name FROM customers WHERE id IN (${placeholders})`,
          customerIds
        );
        customerNames = Object.fromEntries(rows.map(r => [r.id, r.name]));
      }
      const result = quotes.map((q) => ({
        ...q,
        customerName: q.customerId ? (customerNames[q.customerId] ?? null) : null,
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quotes" });
    }
  });

  app.get("/api/admin/quotes/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      // Fetch customer name from customers table if linked
      let customerName: string | null = null;
      if (quote.customerId) {
        const { rows } = await pool.query<{ name: string }>(
          `SELECT name FROM customers WHERE id = $1`,
          [quote.customerId]
        );
        if (rows[0]) customerName = rows[0].name;
      }
      // If the quote has an AI session link, fetch the conversation too
      let aiConversation: any = null;
      const aiSessionId = (quote as any).aiSessionId || (quote as any).ai_session_id;
      if (aiSessionId) {
        const { rows } = await pool.query(
          `SELECT id, session_id, status, messages, mapped_config, contact_name, contact_phone,
                  van_type, van_size, spec_level, finance_preference, includes_48v,
                  was_48v_pitched, response_to_48v, config_completed, marked_contacted,
                  created_at, completed_at
           FROM ai_conversations WHERE session_id = $1`,
          [aiSessionId]
        );
        if (rows[0]) aiConversation = rows[0];
      }
      res.json({ ...quote, customerName, aiConversation });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  // Alias for consistency - both paths work
  app.get("/api/quotes/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  app.patch("/api/admin/quotes/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      // Validate and whitelist allowed fields for admin updates
      const allowedUpdates = z.object({
        status: z.enum(quoteStatuses).optional(),
        financeStatus: z.enum(financeStatuses).optional(),
        buildStage: z.enum(buildStages).nullable().optional(),
        completedBuildStages: z.array(z.union([z.string(), z.object({ id: z.string(), initials: z.string() })])).optional(),
        customBuildStages: z.array(z.object({ id: z.string(), label: z.string() })).nullable().optional(),
        featuredInPortfolio: z.boolean().optional(),
        graphicsArtworkUrl: z.string().url().or(z.literal('')).nullable().optional(),
        graphicsArtworkNotes: z.string().nullable().optional(),
        discountType: z.enum(['percentage', 'fixed']).nullable().optional(),
        discountValue: z.number().int().nullable().optional(),
        vatDeferred: z.boolean().optional(),
        adminNotes: z.string().nullable().optional(),
        customerNotes: z.string().nullable().optional(),
        // New note text to append to history
        newAdminNote: z.string().optional(),
        newCustomerNote: z.string().optional(),
        // Service type (car / commercial / hybrid)
        serviceType: z.enum(["car", "commercial", "hybrid"]).nullable().optional(),
        // Configuration fields
        vanId: z.string().nullable().optional(),
        kitId: z.string().nullable().optional(),
        selectedUpgradeIds: z.array(z.string()).optional(),
        selectedUpgrades: z.record(z.number()).optional(),
        estSubtotal: z.number().int().optional(),
        estDiscount: z.number().int().optional(),
        estVAT: z.number().int().optional(),
        estTotal: z.number().int().optional(),
        // Custom van (off-website) fields
        customVanDescription: z.string().nullable().optional(),
        customVanValue: z.number().int().nullable().optional(),
        // Finance overrides
        financePlanId: z.string().nullable().optional(),
        financeInputs: z.object({
          deposit: z.number().optional(),
          term: z.number().optional(),
          balloon: z.number().optional(),
        }).nullable().optional(),
        // Van registration and mileage (for finance submissions)
        vanRegistration: z.string().nullable().optional(),
        vanMileage: z.number().int().nullable().optional(),
        // Customer confirmation flag
        customerConfirmed: z.boolean().optional(),
        // Customer notes (from configurator form, editable by staff)
        notes: z.string().nullable().optional(),
        // Customer info fields
        userName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().nullable().optional(),
        // Bespoke extras not in standard configurator
        customExtras: z.array(z.object({
          id: z.string(),
          description: z.string(),
          pricePence: z.number().int().min(0),
        })).optional(),
        // Manual customer profile link
        customerId: z.string().nullable().optional(),
        // Pipeline wallboard — due-out date
        targetCompletionDate: z.string().nullable().optional(),
        // Comparison config (A/B compare). Pass-through JSON — slotB pricing
        // is recomputed server-side below.
        comparisonConfig: z.any().optional(),
      });

      const validatedData = allowedUpdates.parse(req.body);
      
      // Handle new notes - append to history
      if (validatedData.newAdminNote || validatedData.newCustomerNote) {
        const quote = await storage.getQuote(req.params.id);
        if (!quote) {
          return res.status(404).json({ error: "Quote not found" });
        }
        
        const user = req.user as any;
        const author = user?.username || 'Admin';
        
        // Append new admin note to history
        if (validatedData.newAdminNote && validatedData.newAdminNote.trim()) {
          const existingAdminHistory = quote.adminNotesHistory || [];
          (validatedData as any).adminNotesHistory = [
            ...existingAdminHistory,
            {
              text: validatedData.newAdminNote.trim(),
              timestamp: new Date().toISOString(),
              author
            }
          ];
        }
        
        // Append new customer note to history
        if (validatedData.newCustomerNote && validatedData.newCustomerNote.trim()) {
          const existingCustomerHistory = quote.customerNotesHistory || [];
          (validatedData as any).customerNotesHistory = [
            ...existingCustomerHistory,
            {
              text: validatedData.newCustomerNote.trim(),
              timestamp: new Date().toISOString(),
              author
            }
          ];
        }
        
        // Remove the temporary fields
        delete (validatedData as any).newAdminNote;
        delete (validatedData as any).newCustomerNote;
      }
      
      // If configuration OR discount fields changed, recalculate pricing server-side
      const needsRecalculation = 'vanId' in validatedData || 'kitId' in validatedData || 
                                  'selectedUpgradeIds' in validatedData || 'selectedUpgrades' in validatedData ||
                                  'discountType' in validatedData || 'discountValue' in validatedData ||
                                  'customVanValue' in validatedData || 'customExtras' in validatedData ||
                                  'comparisonConfig' in validatedData;
      
      if (needsRecalculation) {
        const quote = await storage.getQuote(req.params.id);
        if (!quote) {
          return res.status(404).json({ error: "Quote not found" });
        }

        // Dedupe variants on incoming upgrade list before recalculation
        if (Array.isArray(validatedData.selectedUpgradeIds) && validatedData.selectedUpgradeIds.length > 0) {
          validatedData.selectedUpgradeIds = await dedupeUpgradeIdsByParent(validatedData.selectedUpgradeIds as string[]);
        }

        // Get the configuration (use updated values or fall back to existing)
        const vanId = 'vanId' in validatedData ? validatedData.vanId : quote.vanId;
        const customVanValue = 'customVanValue' in validatedData ? validatedData.customVanValue : (quote as any).customVanValue;
        const kitId = 'kitId' in validatedData ? validatedData.kitId : quote.kitId;
        const selectedUpgradeIds = validatedData.selectedUpgradeIds || quote.selectedUpgradeIds || [];
        const selectedUpgrades = validatedData.selectedUpgrades || quote.selectedUpgrades || {};
        const trainingOptionIds = quote.trainingOptionIds || [];
        const discountType = 'discountType' in validatedData ? validatedData.discountType : quote.discountType;
        const discountValue = 'discountValue' in validatedData ? validatedData.discountValue : quote.discountValue;
        
        // Recalculate base pricing (before discount)
        let baseSubtotal = 0;

        // Add van price — either a system van lookup or a custom van value
        if (vanId) {
          const van = await storage.getVan(vanId);
          if (van) {
            baseSubtotal += vanNetPrice(van);
          }
        } else if (customVanValue) {
          // Custom/off-website van — value stored in pence directly
          baseSubtotal += customVanValue;
        }
        
        // Add kit price
        if (kitId) {
          const kit = await storage.getKit(kitId);
          if (kit) {
            baseSubtotal += kit.price;
          }
        }
        
        // Add upgrade prices
        for (const upgradeId of selectedUpgradeIds) {
          const upgrade = await storage.getUpgrade(upgradeId);
          if (upgrade) {
            const quantity = selectedUpgrades[upgradeId] || 1;
            baseSubtotal += upgrade.price * quantity;
          }
        }
        
        // Add training option prices
        for (const trainingId of trainingOptionIds) {
          const training = await storage.getTrainingOption(trainingId);
          if (training) {
            baseSubtotal += training.price;
          }
        }

        // Add custom extras (bespoke items not in standard configurator)
        const updatedCustomExtras = 'customExtras' in validatedData ? (validatedData.customExtras || []) : ((quote as any).customExtras || []);
        const customExtrasTotal = updatedCustomExtras.reduce((sum: number, e: any) => sum + (e.pricePence || 0), 0);
        baseSubtotal += customExtrasTotal;
        
        // Honour the quote's VAT-deferral flag (incoming value wins, else the
        // stored one) — a deferred quote is charged no VAT.
        const vatDeferred = ('vatDeferred' in validatedData
          ? (validatedData as any).vatDeferred
          : (quote as any).vatDeferred) === true;

        const patchTotals = computeQuoteTotals({
          subtotal: baseSubtotal,
          discountType: discountType as any,
          discountValue,
          vatDeferred,
        });

        // Store final pricing and discount amount
        validatedData.estSubtotal = patchTotals.finalSubtotal;
        validatedData.estVAT = patchTotals.finalVAT;
        validatedData.estTotal = patchTotals.totalAfterDiscount;
        (validatedData as any).estDiscount = patchTotals.discountAmount;

        // If this is a comparison quote, also recompute slotB pricing so its
        // estTotal stays in sync with whatever discount is now in effect for
        // it (its own independent discount when set, or the main quote
        // discount as a fallback). Without this the chosen-option email for
        // Option B would still show the pre-edit total.
        const incomingComparison: any = (validatedData as any).comparisonConfig;
        const existingComparison: any = (quote as any).comparisonConfig;
        const mergedComparison: any = incomingComparison ?? existingComparison;
        if (mergedComparison?.slotA && mergedComparison?.slotB) {
          const slotB = mergedComparison.slotB;
          try {
            const slotBUpgradeIds: string[] = slotB.upgradeIds || [];
            const slotBTrainingIds: string[] = slotB.trainingOptionIds || [];
            const [slotBVanData, slotBKitData, slotBUpgradeData, slotBTrainingData] = await Promise.all([
              slotB.vanId ? storage.getVan(slotB.vanId) : Promise.resolve(null),
              slotB.kitId ? storage.getKit(slotB.kitId) : Promise.resolve(null),
              slotBUpgradeIds.length > 0
                ? Promise.all(slotBUpgradeIds.map((uid: string) => storage.getUpgrade(uid)))
                : Promise.resolve([]),
              slotBTrainingIds.length > 0
                ? Promise.all(slotBTrainingIds.map((tid: string) => storage.getTrainingOption(tid)))
                : Promise.resolve([]),
            ]);
            // Slot B shares the quote's upgrade quantity map with slot A.
            const slotBQuantities = (selectedUpgrades as Record<string, number>) || {};
            const slotBSubtotal =
              vanNetPrice(slotBVanData as any, slotB.customVanValue) +
              ((slotBKitData as any)?.price ?? 0) +
              slotBUpgradeData.filter(Boolean).reduce((s: number, u: any) => s + ((u?.price ?? 0) * (slotBQuantities[u?.id] || 1)), 0) +
              slotBTrainingData.filter(Boolean).reduce((s: number, t: any) => s + (t?.price ?? 0), 0);
            const slotBTotals = computeQuoteTotals({
              subtotal: slotBSubtotal,
              discountType: (slotB.discountType ?? discountType) as any,
              discountValue: Number(slotB.discountValue ?? discountValue) || null,
              vatDeferred,
            });
            (validatedData as any).comparisonConfig = {
              ...mergedComparison,
              slotB: {
                ...slotB,
                estSubtotal: slotBTotals.finalSubtotal,
                estVAT: slotBTotals.finalVAT,
                estTotal: slotBTotals.totalAfterDiscount,
                estDiscount: slotBTotals.discountAmount,
              },
            };
          } catch (err) {
            console.error('Failed to recompute slotB pricing on PATCH:', err);
          }
        }
      }
      
      // Auto-audit note: status change
      if (validatedData.status) {
        const statusLabels: Record<string, string> = {
          pending: 'Pending', new: 'New', contacted: 'Contacted',
          payment_finance: 'Payment / Finance', in_build: 'In Build', completed: 'Completed'
        };
        const currentQuote = await storage.getQuote(req.params.id);
        if (currentQuote && currentQuote.status !== validatedData.status) {
          const user = req.user as any;
          const author = user?.username || 'System';
          const from = statusLabels[currentQuote.status] || currentQuote.status;
          const to = statusLabels[validatedData.status] || validatedData.status;
          const existingHistory = (validatedData as any).adminNotesHistory || currentQuote.adminNotesHistory || [];
          (validatedData as any).adminNotesHistory = [
            ...existingHistory,
            { text: `Status changed from "${from}" to "${to}"`, timestamp: new Date().toISOString(), author }
          ];
        }
      }

      // Auto-stamp statusChangedAt whenever status is being changed
      if ('status' in validatedData) {
        (validatedData as any).statusChangedAt = new Date();
      }

      // Coerce targetCompletionDate (ISO string from client) → Date for the
      // Postgres timestamp column. Drizzle calls .toISOString() on the value
      // and throws "value.toISOString is not a function" if a raw string is
      // passed through.
      if ('targetCompletionDate' in validatedData) {
        const raw = (validatedData as any).targetCompletionDate;
        (validatedData as any).targetCompletionDate =
          raw === null || raw === undefined || raw === '' ? null : new Date(raw);
      }

      const updated = await storage.updateQuote(req.params.id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: "Quote not found" });
      }
      res.json(updated);

      // Re-link / update customer if contact fields changed
      const patchedUserName = typeof (validatedData as Record<string, unknown>).userName === "string"
        ? (validatedData as Record<string, unknown>).userName as string : undefined;
      const patchedEmail = typeof (validatedData as Record<string, unknown>).email === "string"
        ? (validatedData as Record<string, unknown>).email as string : undefined;
      const patchedPhone = typeof (validatedData as Record<string, unknown>).phone === "string"
        ? (validatedData as Record<string, unknown>).phone as string : undefined;
      if (patchedUserName !== undefined || patchedEmail !== undefined || patchedPhone !== undefined) {
        const effectiveEmail = patchedEmail ?? updated.email ?? null;
        const effectivePhone = patchedPhone ?? updated.phone ?? null;
        const effectiveName = patchedUserName ?? updated.userName ?? "Unknown";
        if (effectiveEmail || effectivePhone) {
          storage.findOrCreateCustomer(effectiveEmail, effectivePhone, effectiveName)
            .then(customer =>
              storage.linkQuoteToCustomer(updated.id, customer.id, "System (auto-link)")
                .then(() => storage.backfillLeadsAndQuotesForCustomer(customer.id, effectiveEmail, effectivePhone))
            )
            .catch(err => console.error("Customer re-link (quote update):", err?.message));
        }
      }

      // ── Auto-dispatch when moving to "in_build" ─────────────────────────
      if (validatedData.status === 'in_build') {
        (async () => {
          try {
            const apiKey = process.env.VAN_CONFIGURATOR_API_KEY;
            if (!apiKey) {
              console.warn('[van-build] VAN_CONFIGURATOR_API_KEY not set — skipping auto-dispatch');
              return;
            }

            // Build vanDescription from the linked van or custom text
            let vanDescription = '';
            if (updated.vanId) {
              const van = await storage.getVan(updated.vanId);
              if (van) {
                vanDescription = `${van.make} ${van.model}`;
                if (van.reg) vanDescription += ` (${van.reg})`;
              }
            } else if ((updated as any).customVanDescription) {
              vanDescription = (updated as any).customVanDescription;
            }
            if (!vanDescription) vanDescription = 'Van (details not specified)';

            // Build items: kit first, then each upgrade with its quantity
            const items: Array<{ description: string; quantity: number }> = [];
            if (updated.kitId) {
              const kit = await storage.getKit(updated.kitId);
              if (kit) items.push({ description: kit.name, quantity: 1 });
            }
            const selectedUpgrades: Record<string, number> = (updated.selectedUpgrades as Record<string, number>) || {};
            for (const [upgradeId, qty] of Object.entries(selectedUpgrades)) {
              const upgrade = await storage.getUpgrade(upgradeId);
              if (upgrade) items.push({ description: upgrade.name, quantity: qty });
            }

            const payload = {
              vanDescription,
              items,
              customerName: updated.userName || undefined,
              customerContact: updated.email || updated.phone || undefined,
              notes: (updated as any).adminNotes || undefined,
            };

            const STOCK_SITE = 'https://autotradeportal.com';
            const response = await fetch(`${STOCK_SITE}/api/external/van-build-request`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': apiKey,
              },
              body: JSON.stringify(payload),
            });

            if (response.status === 201) {
              const responseData = await response.json() as { id?: string };
              const stockBuildId = responseData.id || `local-${crypto.randomUUID()}`;
              console.log(`[van-build] Auto-dispatched build request for quote ${updated.id}, stock build ID: ${stockBuildId}`);
              await storage.updateQuote(req.params.id, { stockBuildId } as any);
            } else {
              const text = await response.text();
              console.warn(`[van-build] Unexpected response ${response.status} for quote ${updated.id}: ${text}`);
              // Still assign a local ID so the build sheet always gets a QR code
              const stockBuildId = `local-${crypto.randomUUID()}`;
              console.log(`[van-build] Assigning local stock build ID: ${stockBuildId}`);
              await storage.updateQuote(req.params.id, { stockBuildId } as any);
            }
          } catch (err) {
            console.error('[van-build] Auto-dispatch failed:', err);
            // Assign a local ID so the build sheet still gets a QR code even if the network call fails
            try {
              const stockBuildId = `local-${crypto.randomUUID()}`;
              await storage.updateQuote(req.params.id, { stockBuildId } as any);
              console.log(`[van-build] Network error fallback — assigned local stock build ID: ${stockBuildId}`);
            } catch (_) {}
          }
        })();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('PATCH /api/admin/quotes/:id Zod validation failed. Body keys:', Object.keys(req.body), 'Errors:', JSON.stringify(error.errors));
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      console.error('PATCH /api/admin/quotes/:id unexpected error:', error);
      res.status(500).json({ error: "Failed to update quote" });
    }
  });

  // Delete a quote (admin only)
  app.delete("/api/admin/quotes/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteQuote(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting quote:', error);
      res.status(500).json({ error: "Failed to delete quote" });
    }
  });

  // Edit a specific note in the history
  app.post("/api/admin/quotes/:id/notes", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { text, author } = req.body;
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "text is required" });
      }
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });

      const newEntry = { text: text.trim(), timestamp: new Date().toISOString(), author: author || "Admin" };
      const updated = await storage.updateQuote(req.params.id, {
        adminNotesHistory: [...(quote.adminNotesHistory || []), newEntry],
      });
      if (!updated) return res.status(500).json({ error: "Failed to add note" });
      res.json(updated);
    } catch (error) {
      console.error("Error adding note:", error);
      res.status(500).json({ error: "Failed to add note" });
    }
  });

  app.patch("/api/admin/quotes/:id/notes", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { noteType, timestamp, text } = req.body;
      
      // Validate input
      if (!noteType || !timestamp || !text) {
        return res.status(400).json({ error: "noteType, timestamp, and text are required" });
      }
      
      if (noteType !== 'admin' && noteType !== 'customer') {
        return res.status(400).json({ error: "noteType must be 'admin' or 'customer'" });
      }
      
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      const historyField = noteType === 'admin' ? 'adminNotesHistory' : 'customerNotesHistory';
      const history = quote[historyField] || [];
      
      // Find and update the note with matching timestamp
      const noteIndex = history.findIndex((note: any) => note.timestamp === timestamp);
      if (noteIndex === -1) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      // Update the note text (keep original timestamp and author)
      history[noteIndex].text = text.trim();
      
      // Update the quote
      const updated = await storage.updateQuote(req.params.id, {
        [historyField]: history
      });
      
      if (!updated) {
        return res.status(500).json({ error: "Failed to update note" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating note:', error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  // Shared HTML renderer for customer-facing choose-option pages
  function chooseOptionHtmlPage(title: string, heading: string, body: string, isError = false) {
    const brandGreen = BRAND.theme.accentHex;
    const brandDark = BRAND.theme.darkHex;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – ${BRAND.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: ${brandDark}; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fff; max-width: 480px; width: 100%; border-radius: 8px; overflow: hidden; }
    .card-header { background: ${brandDark}; padding: 28px 32px; border-bottom: 3px solid ${brandGreen}; }
    .card-header h1 { color: ${brandGreen}; font-size: 22px; }
    .card-header p { color: #ccc; font-size: 13px; margin-top: 4px; }
    .card-body { padding: 28px 32px; }
    .card-body h2 { color: ${isError ? '#dc2626' : brandDark}; font-size: 20px; margin-bottom: 12px; }
    .card-body p { color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 12px; }
    .badge { display: inline-block; background: ${brandGreen}; color: ${brandDark}; font-weight: bold; font-size: 14px; padding: 6px 18px; border-radius: 4px; margin-bottom: 16px; }
    .phone { color: ${brandDark}; font-weight: bold; }
    .confirm-btn { display: block; width: 100%; background: ${brandGreen}; color: ${brandDark}; font-weight: bold; font-size: 16px; padding: 14px 24px; border-radius: 4px; border: none; cursor: pointer; margin-top: 8px; }
    .confirm-btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <h1>${BRAND.name}</h1>
      <p>${BRAND.domain}</p>
    </div>
    <div class="card-body">
      <h2>${heading}</h2>
      ${body}
    </div>
  </div>
</body>
</html>`;
  }

  // Public: customer clicks "I choose Option A/B" link from their confirmation email.
  // GET renders a confirmation page (no state change) — safe for mail scanners and prefetch.
  // POST (below) performs the actual state change after the customer clicks the confirmation button.
  app.get("/api/quotes/:id/choose-option", async (req, res) => {
    try {
      const { option, token: chooseToken } = req.query;
      if (option !== 'A' && option !== 'B') {
        res.status(400).send(chooseOptionHtmlPage('Invalid Request', 'Invalid request', '<p>The link you followed is not valid. Please contact us directly.</p>', true));
        return;
      }

      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        res.status(404).send(chooseOptionHtmlPage('Not Found', 'Quote not found', '<p>We could not find your quote. Please contact us and we\'ll be happy to help.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>', true));
        return;
      }

      // Validate the one-time choose-option token — prevents bare-UUID replay attacks.
      // This is a read-only check; the POST handler will validate and invalidate the token.
      const storedToken = quote.chooseOptionToken;
      if (!storedToken || !chooseToken || chooseToken !== storedToken) {
        res.status(400).send(chooseOptionHtmlPage('Invalid Link', 'This link is no longer valid', '<p>This selection link has expired or is invalid. Please use the link from the most recent email we sent you, or call us directly.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>', true));
        return;
      }

      if (!quote.comparisonConfig?.slotA || !quote.comparisonConfig?.slotB) {
        res.status(400).send(chooseOptionHtmlPage('Not Available', 'Option selection not available', '<p>This quote does not have two options to choose from. Please contact us directly.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>', true));
        return;
      }

      if (quote.chosenOption) {
        const alreadyOption = quote.chosenOption;
        const sameChoice = alreadyOption === option;
        res.send(chooseOptionHtmlPage(
          'Already Selected',
          sameChoice ? 'Choice already recorded' : 'An option has already been selected',
          sameChoice
            ? `<p class="badge">Option ${alreadyOption}</p><p>We already have your preference for <strong>Option ${alreadyOption}</strong> on record. Our team will be in touch shortly.</p><p>Call us on <span class="phone">0800 000 0000</span> if you have any questions.</p>`
            : `<p>You have already selected <strong>Option ${alreadyOption}</strong> for this quote. If you'd like to change your preference, please call us directly.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>`,
        ));
        return;
      }

      if (quote.buildStage != null) {
        res.send(chooseOptionHtmlPage('Selection Closed', 'Selection period has closed', '<p>Your build has already started so we\'re unable to accept a new option selection via this link. Please call us if you have any queries.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>'));
        return;
      }

      // Render a confirmation page with a POST form — no state is changed on GET.
      // This ensures mail scanners, prefetch, and accidental link clicks cannot trigger the choice.
      const brandGreen = BRAND.theme.accentHex;
      res.send(chooseOptionHtmlPage(
        `Confirm Option ${option}`,
        `Confirm your choice`,
        `<p>You are about to select <strong>Option ${option}</strong> as your preferred quote.</p>
        <p>Please click the button below to confirm. Our team will be notified immediately.</p>
        <form method="POST" action="/api/quotes/${req.params.id}/choose-option">
          <input type="hidden" name="option" value="${option}">
          <input type="hidden" name="token" value="${String(chooseToken)}">
          <button type="submit" class="confirm-btn">Confirm — I choose Option ${option}</button>
        </form>
        <p style="margin-top:16px;font-size:13px;color:#9ca3af;">If you did not request this, please ignore this page or call us on <span class="phone" style="color:#374151;font-weight:bold">0800 000 0000</span>.</p>`,
      ));
    } catch (error) {
      console.error('Error rendering option choice page:', error);
      res.status(500).send(chooseOptionHtmlPage('Error', 'Something went wrong', '<p>We were unable to load this page at this time. Please call us on <span class="phone">0800 000 0000</span> and we\'ll sort it out for you.</p>', true));
    }
  });

  // Public: customer submits the confirmation form to register their option choice.
  // Validates the token, performs the state change, then invalidates the token.
  app.post("/api/quotes/:id/choose-option", async (req, res) => {
    try {
      const option = req.body.option;
      const chooseToken = req.body.token;

      if (option !== 'A' && option !== 'B') {
        res.status(400).send(chooseOptionHtmlPage('Invalid Request', 'Invalid request', '<p>The request was not valid. Please use the link from your email and try again.</p>', true));
        return;
      }

      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        res.status(404).send(chooseOptionHtmlPage('Not Found', 'Quote not found', '<p>We could not find your quote. Please contact us and we\'ll be happy to help.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>', true));
        return;
      }

      // Validate token — reject if missing, expired (cleared after prior selection), or mismatched.
      const storedToken = quote.chooseOptionToken;
      if (!storedToken || !chooseToken || chooseToken !== storedToken) {
        res.status(400).send(chooseOptionHtmlPage('Invalid Link', 'This link is no longer valid', '<p>This selection link has expired or is invalid. Please use the link from the most recent email we sent you, or call us directly.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>', true));
        return;
      }

      if (!quote.comparisonConfig?.slotA || !quote.comparisonConfig?.slotB) {
        res.status(400).send(chooseOptionHtmlPage('Not Available', 'Option selection not available', '<p>This quote does not have two options to choose from. Please contact us directly.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>', true));
        return;
      }

      if (quote.chosenOption) {
        const alreadyOption = quote.chosenOption;
        const sameChoice = alreadyOption === option;
        res.send(chooseOptionHtmlPage(
          'Already Selected',
          sameChoice ? 'Choice already recorded' : 'An option has already been selected',
          sameChoice
            ? `<p class="badge">Option ${alreadyOption}</p><p>We already have your preference for <strong>Option ${alreadyOption}</strong> on record. Our team will be in touch shortly.</p><p>Call us on <span class="phone">0800 000 0000</span> if you have any questions.</p>`
            : `<p>You have already selected <strong>Option ${alreadyOption}</strong> for this quote. If you'd like to change your preference, please call us directly.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>`,
        ));
        return;
      }

      if (quote.buildStage != null) {
        res.send(chooseOptionHtmlPage('Selection Closed', 'Selection period has closed', '<p>Your build has already started so we\'re unable to accept a new option selection via this link. Please call us if you have any queries.</p><p>Call us on <span class="phone">0800 000 0000</span>.</p>'));
        return;
      }

      // Promote the chosen slot data into the primary quote fields (same logic as admin endpoint).
      // Also clear chooseOptionToken so the link cannot be reused.
      const slotData = option === 'B' ? quote.comparisonConfig.slotB : quote.comparisonConfig.slotA;
      const updateData: any = {
        chosenOption: option,
        chooseOptionToken: null, // Invalidate token after successful selection
      };

      if (slotData) {
        updateData.vanId = slotData.vanId ?? null;
        updateData.customVanDescription = slotData.customVanDescription ?? null;
        updateData.customVanValue = slotData.customVanValue ?? null;
        updateData.vanRegistration = slotData.vanRegistration ?? null;
        updateData.serviceType = slotData.serviceType ?? null;
        updateData.kitId = slotData.kitId ?? null;
        updateData.selectedUpgradeIds = slotData.upgradeIds ?? [];
        // Preserve the quote's existing quantities (slots share the
        // quote-level quantity map; wiping them to 1 silently changed the
        // price on the next recalculation).
        const existingQuantities = (quote.selectedUpgrades as Record<string, number>) || {};
        const upgradeQtyMap: Record<string, number> = {};
        (slotData.upgradeIds ?? []).forEach((uid: string) => { upgradeQtyMap[uid] = existingQuantities[uid] || 1; });
        updateData.selectedUpgrades = upgradeQtyMap;
        updateData.trainingOptionIds = slotData.trainingOptionIds ?? [];
        updateData.financePlanId = slotData.financePlanId ?? null;
        updateData.financeInputs = slotData.financeInputs ?? null;
        if (slotData.estSubtotal != null) updateData.estSubtotal = slotData.estSubtotal;
        if (slotData.estVAT != null) updateData.estVAT = slotData.estVAT;
        if (slotData.estTotal != null) updateData.estTotal = slotData.estTotal;
      }

      const adminNotesHistory = Array.isArray(quote.adminNotesHistory) ? [...quote.adminNotesHistory] : [];
      adminNotesHistory.push({
        text: `Customer selected Option ${option} via the email link.`,
        timestamp: new Date().toISOString(),
        author: 'Customer',
      });
      updateData.adminNotesHistory = adminNotesHistory;

      await storage.updateQuote(req.params.id, updateData);

      // Send admin notification (non-blocking)
      try {
        const { sendOptionChosenAdminNotification } = await import('./email.js');
        const van = slotData?.vanId ? await storage.getVan(slotData.vanId) : null;
        const kit = slotData?.kitId ? await storage.getKit(slotData.kitId) : null;
        const upgradeIds: string[] = slotData?.upgradeIds ?? [];
        const upgrades = upgradeIds.length > 0
          ? await sortUpgradesByDisplayOrder((await Promise.all(upgradeIds.map((uid) => storage.getUpgrade(uid)))).filter(Boolean) as any[])
          : [];

        await sendOptionChosenAdminNotification({
          quoteId: quote.id,
          customerName: quote.userName,
          customerEmail: quote.email,
          customerPhone: quote.phone,
          chosenOption: option,
          optionDetails: {
            vanTitle: van?.title ?? (slotData?.vanRegistration ? `Own van (${slotData.vanRegistration})` : null),
            kitName: kit?.name ?? null,
            upgradeNames: upgrades.map((u: any) => u.name),
            estTotal: slotData?.estTotal,
          },
        });
      } catch (emailErr) {
        console.error('Failed to send option chosen notification:', emailErr);
      }

      const ref = quote.id.slice(0, 8).toUpperCase();
      res.send(chooseOptionHtmlPage(
        `Option ${option} Selected`,
        `Thank you — Option ${option} confirmed!`,
        `<p class="badge">Option ${option} Selected</p>
        <p>We've recorded your choice and our team has been notified. We'll be in touch shortly to discuss the next steps.</p>
        <p>Your reference is <strong>#${ref}</strong>.</p>
        <p>If you have any questions in the meantime, please call us on <span class="phone">${BRAND.phone}</span> or email <a href="mailto:${BRAND.infoEmail}" style="color:${BRAND.theme.accentHex}">${BRAND.infoEmail}</a>.</p>`,
      ));
    } catch (error) {
      console.error('Error processing customer option choice:', error);
      res.status(500).send(chooseOptionHtmlPage('Error', 'Something went wrong', '<p>We were unable to record your choice at this time. Please call us on <span class="phone">0800 000 0000</span> and we\'ll sort it out for you.</p>', true));
    }
  });

  // Lock in a customer's chosen option (A or B) for a comparison quote
  app.patch("/api/admin/quotes/:id/choose-option", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { option } = req.body; // 'A' or 'B'
      if (option !== 'A' && option !== 'B') {
        return res.status(400).json({ error: "option must be 'A' or 'B'" });
      }

      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Guard: this endpoint is only valid for comparison quotes that have both slots configured
      if (!quote.comparisonConfig?.slotA || !quote.comparisonConfig?.slotB) {
        return res.status(400).json({ error: "Quote does not have a comparison configuration" });
      }

      // Guard: cannot change chosen option once the build has started
      if (quote.buildStage != null) {
        return res.status(409).json({ error: "Cannot change chosen option after build has started" });
      }

      const updateData: Partial<Quote> = {
        chosenOption: option,
      };

      // Promote the selected slot's configuration into the primary quote fields.
      // This is done for BOTH A and B so that primary fields always reflect the chosen option,
      // which is critical when an admin switches back from B to A (or vice versa).
      const slotData = option === 'B'
        ? quote.comparisonConfig?.slotB
        : quote.comparisonConfig?.slotA;

      if (slotData) {
        updateData.vanId = slotData.vanId ?? null;
        updateData.customVanDescription = slotData.customVanDescription ?? null;
        updateData.customVanValue = slotData.customVanValue ?? null;
        updateData.vanRegistration = slotData.vanRegistration ?? null;
        updateData.serviceType = (slotData.serviceType as Quote['serviceType']) ?? null;
        updateData.kitId = slotData.kitId ?? null;
        updateData.selectedUpgradeIds = slotData.upgradeIds ?? [];
        // Rebuild the upgrade quantity map, preserving the quote's existing
        // quantities (slots share the quote-level quantity map; wiping them
        // to 1 silently changed the price on the next recalculation).
        const existingQuantities = (quote.selectedUpgrades as Record<string, number>) || {};
        const upgradeQtyMap: Record<string, number> = {};
        (slotData.upgradeIds ?? []).forEach((uid) => { upgradeQtyMap[uid] = existingQuantities[uid] || 1; });
        updateData.selectedUpgrades = upgradeQtyMap;
        updateData.trainingOptionIds = slotData.trainingOptionIds ?? [];
        updateData.financePlanId = slotData.financePlanId ?? null;
        updateData.financeInputs = slotData.financeInputs ?? null;
        // Promote pricing if stored in the slot
        if (slotData.estSubtotal != null) updateData.estSubtotal = slotData.estSubtotal;
        if (slotData.estVAT != null) updateData.estVAT = slotData.estVAT;
        if (slotData.estTotal != null) updateData.estTotal = slotData.estTotal;
      }

      // Append an admin note with actor identity (session only has id/username, look up full name if possible)
      const sessionUser = req.session?.user;
      let actorName = sessionUser?.username ?? 'Admin';
      if (sessionUser?.id) {
        const adminUserRecord = await storage.getUser(sessionUser.id);
        if (adminUserRecord?.firstName) {
          actorName = adminUserRecord.firstName + (adminUserRecord.lastName ? ' ' + adminUserRecord.lastName : '');
        }
      }
      const adminNotesHistory = Array.isArray(quote.adminNotesHistory) ? [...quote.adminNotesHistory] : [];
      adminNotesHistory.push({
        text: `Customer chose Option ${option} from the comparison quote.`,
        timestamp: new Date().toISOString(),
        author: actorName,
      });
      updateData.adminNotesHistory = adminNotesHistory;

      const updated = await storage.updateQuote(req.params.id, updateData);
      if (!updated) {
        return res.status(500).json({ error: "Failed to update quote" });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error choosing option:', error);
      res.status(500).json({ error: "Failed to choose option" });
    }
  });

  // Reset/undo a chosen comparison option (sets chosenOption back to null)
  app.delete("/api/admin/quotes/:id/choose-option", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      if (!quote.comparisonConfig?.slotA || !quote.comparisonConfig?.slotB) {
        return res.status(400).json({ error: "Quote does not have a comparison configuration" });
      }

      if (quote.chosenOption == null) {
        return res.status(400).json({ error: "No option is currently chosen" });
      }

      // Guard: cannot undo choice once build has started
      if (quote.buildStage != null) {
        return res.status(409).json({ error: "Cannot undo chosen option after build has started" });
      }

      const sessionUser = req.session?.user;
      let actorName = sessionUser?.username ?? 'Admin';
      if (sessionUser?.id) {
        const adminUserRecord = await storage.getUser(sessionUser.id);
        if (adminUserRecord?.firstName) {
          actorName = adminUserRecord.firstName + (adminUserRecord.lastName ? ' ' + adminUserRecord.lastName : '');
        }
      }

      const adminNotesHistory = Array.isArray(quote.adminNotesHistory) ? [...quote.adminNotesHistory] : [];
      adminNotesHistory.push({
        text: `Option choice (Option ${quote.chosenOption}) was reset by ${actorName} — quote returned to pending decision.`,
        timestamp: new Date().toISOString(),
        author: actorName,
      });

      const updated = await storage.updateQuote(req.params.id, {
        chosenOption: null,
        adminNotesHistory,
      });

      if (!updated) {
        return res.status(500).json({ error: "Failed to reset option choice" });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error resetting option choice:', error);
      res.status(500).json({ error: "Failed to reset option choice" });
    }
  });

  // Delete a specific note from the history
  app.delete("/api/admin/quotes/:id/notes", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { noteType, timestamp } = req.body;
      
      // Validate input
      if (!noteType || !timestamp) {
        return res.status(400).json({ error: "noteType and timestamp are required" });
      }
      
      if (noteType !== 'admin' && noteType !== 'customer') {
        return res.status(400).json({ error: "noteType must be 'admin' or 'customer'" });
      }
      
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      
      const historyField = noteType === 'admin' ? 'adminNotesHistory' : 'customerNotesHistory';
      const history = quote[historyField] || [];
      
      // Filter out the note with matching timestamp
      const updatedHistory = history.filter((note: any) => note.timestamp !== timestamp);
      
      if (updatedHistory.length === history.length) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      // Update the quote
      const updated = await storage.updateQuote(req.params.id, {
        [historyField]: updatedHistory
      });
      
      if (!updated) {
        return res.status(500).json({ error: "Failed to delete note" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error deleting note:', error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  // Send spec summary email to customer (admin triggered — no status change)
  app.post("/api/admin/quotes/:id/send-confirmation", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Generate a fresh approval token (resets any prior approval when resending)
      const { randomBytes } = await import('crypto');
      const approvalToken = randomBytes(32).toString('hex');

      // Fetch van, kit, upgrade details for the email
      const [van, kit, selectedUpgrades] = await Promise.all([
        quote.vanId ? storage.getVan(quote.vanId) : Promise.resolve(null),
        quote.kitId ? storage.getKit(quote.kitId) : Promise.resolve(null),
        quote.selectedUpgradeIds && quote.selectedUpgradeIds.length > 0
          ? Promise.all(quote.selectedUpgradeIds.map((uid: string) => storage.getUpgrade(uid)))
          : Promise.resolve([]),
      ]);

      // estSubtotal + estVAT are already post-discount values stored at save time.
      // estDiscount holds the discount amount in pence. Use these directly.
      const discount = quote.estDiscount || 0;
      const totalAfterDiscount = quote.estTotal; // already the correct post-discount total
      // Pre-discount total (for email display: template subtracts discount from this)
      const totalWithVat = totalAfterDiscount + discount;

      // Helper: compute finance monthly/weekly from a total (in pence) and
      // financeInputs, using the quote's actual finance plan APR when set.
      const specFinancePlan = quote.financePlanId ? await storage.getFinancePlan(quote.financePlanId) : null;
      const specAprBps = specFinancePlan?.aprBps ?? 1090;
      const calcSpecFinance = (totalPence: number, fi: { deposit?: number; term?: number } | null | undefined) => {
        if (!fi || !fi.term || fi.term <= 0 || totalPence <= 0) return null;
        const depositAmount: number = fi.deposit ?? 0;
        const payments = computeFinancePayments(totalPence, depositAmount, fi.term, specAprBps);
        if (!payments) return null;
        return { depositAmount, termMonths: fi.term, ...payments };
      };

      const fi = quote.financeInputs as { deposit?: number; term?: number } | null | undefined;
      const specFinanceInfo = calcSpecFinance(totalAfterDiscount, fi);

      // If comparison quote — fetch slot B details for the email
      const slotBConfig = (quote as any).comparisonConfig?.slotB;
      let comparisonSlotBEmail: {
        vanTitle?: string | null;
        kitName?: string | null;
        upgradeNames?: string[];
        estSubtotal?: number;
        estVAT?: number;
        estTotal?: number;
        financeInfo?: { depositAmount: number; termMonths: number; monthlyPayment: number; weeklyPayment: number } | null;
      } | null = null;

      if (slotBConfig) {
        // In compare mode, kit/upgrades are always shared from Option A — always use the primary
        // quote.selectedUpgradeIds so Option B shows the same equipment as Option A.
        // This prevents stale slotB.upgradeIds (e.g. from edits or old submissions) causing divergence.
        const slotBUpgradeIds: string[] = (quote.selectedUpgradeIds as string[]) || slotBConfig.upgradeIds || [];
        const [slotBVan, slotBKit, slotBUpgrades] = await Promise.all([
          slotBConfig.vanId ? storage.getVan(slotBConfig.vanId) : Promise.resolve(null),
          slotBConfig.kitId ? storage.getKit(slotBConfig.kitId) : Promise.resolve(null),
          slotBUpgradeIds.length > 0
            ? Promise.all(slotBUpgradeIds.map((uid: string) => storage.getUpgrade(uid)))
            : Promise.resolve([]),
        ]);
        const slotBTotal = slotBConfig.estTotal ?? 0;
        comparisonSlotBEmail = {
          vanTitle: (slotBVan as any)?.title ?? (slotBConfig.vanRegistration ? `Own van (${slotBConfig.vanRegistration})` : null),
          kitName: (slotBKit as any)?.name ?? null,
          upgradeNames: (await sortUpgradesByDisplayOrder(slotBUpgrades.filter(Boolean) as any[])).map((u: any) => u.name),
          estSubtotal: slotBConfig.estSubtotal,
          estVAT: slotBConfig.estVAT,
          estTotal: slotBTotal,
          financeInfo: calcSpecFinance(slotBTotal, fi),
        };
      }

      // Get latest customer-facing note
      const customerNotesHistory = quote.customerNotesHistory || [];
      const latestCustomerNote = customerNotesHistory.length > 0
        ? customerNotesHistory[customerNotesHistory.length - 1].text
        : null;

      // Derive site base URL — use SITE_URL env var (for production) or fall back to the
      // incoming request headers, respecting any X-Forwarded-Proto from the proxy
      const siteBaseUrl = process.env.SITE_URL || (() => {
        const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
        const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
        return `${proto}://${host}`;
      })();

      // For comparison quotes, regenerate the choose-option token so old email links are
      // invalidated and only the freshly sent email's links will work.
      let chooseOptionToken: string | undefined;
      if (comparisonSlotBEmail) {
        const { randomBytes } = await import('crypto');
        chooseOptionToken = randomBytes(32).toString('hex');
      }

      const { sendQuoteSpecSummaryEmail } = await import('./email.js');
      await sendQuoteSpecSummaryEmail({
        to: quote.email,
        customerName: quote.userName,
        quoteId: quote.id,
        vanTitle: van?.title ?? null,
        kitName: kit?.name ?? null,
        upgradeNames: (await sortUpgradesByDisplayOrder(selectedUpgrades.filter(Boolean) as any[])).map((u: any) => u.name),
        customExtras: ((quote as any).customExtras as Array<{id:string;description:string;pricePence:number}>) || [],
        subtotal: quote.estSubtotal,
        vat: quote.estVAT,
        total: totalWithVat,
        discount: discount > 0 ? discount : undefined,
        customerNote: latestCustomerNote,
        // Only pass approval token for single-van quotes — comparison uses choose-option buttons instead
        approvalToken: comparisonSlotBEmail ? undefined : approvalToken,
        siteBaseUrl,
        financeInfo: specFinanceInfo,
        comparisonSlotB: comparisonSlotBEmail,
        chosenOption: ((quote as any).chosenOption as 'A' | 'B' | null) ?? null,
        chooseOptionToken,
      });

      // Record specSentAt, store approval token (resets prior approval), add auto-audit note
      const specUser = req.user as any;
      const specAuthor = specUser?.username || 'System';
      const specNoteText = `Spec summary email sent to customer (${quote.email})`;
      await storage.updateQuote(req.params.id, {
        specSentAt: new Date(),
        approvalToken,
        specApprovalStatus: null,
        specApprovalComments: null,
        ...(chooseOptionToken ? { chooseOptionToken } : {}),
        adminNotesHistory: [
          ...(quote.adminNotesHistory || []),
          { text: specNoteText, timestamp: new Date().toISOString(), author: specAuthor }
        ],
      } as any);

      res.json({ success: true, emailSent: true, specSentAt: new Date().toISOString() });
    } catch (error) {
      console.error('Error sending spec summary email:', error);
      res.status(500).json({ error: "Failed to send summary email" });
    }
  });

  // Send depot invoice request email to the admin invoicing team
  // (recipients are whoever is subscribed to the depot_invoice channel in
  // Settings → Notification Recipients).
  app.post("/api/admin/quotes/:id/send-to-depot", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      const [van, kit, selectedUpgrades] = await Promise.all([
        quote.vanId ? storage.getVan(quote.vanId) : Promise.resolve(null),
        quote.kitId ? storage.getKit(quote.kitId) : Promise.resolve(null),
        quote.selectedUpgradeIds && quote.selectedUpgradeIds.length > 0
          ? Promise.all(quote.selectedUpgradeIds.map((uid: string) => storage.getUpgrade(uid)))
          : Promise.resolve([]),
      ]);

      const discount = quote.estDiscount || 0;
      const totalAfterDiscount = quote.estTotal;
      const totalWithVat = totalAfterDiscount + discount;

      // Build finance info if available, using the quote's finance plan APR when set
      let financeInfo: { depositAmount: number; termMonths: number; monthlyPayment: number; weeklyPayment: number } | null = null;
      const fi = quote.financeInputs as { deposit?: number; term?: number } | null | undefined;
      if (fi?.term && fi.term > 0 && totalAfterDiscount > 0) {
        const depositAmount = fi.deposit ?? 0;
        const depotFinancePlan = quote.financePlanId ? await storage.getFinancePlan(quote.financePlanId) : null;
        const payments = computeFinancePayments(totalAfterDiscount, depositAmount, fi.term, depotFinancePlan?.aprBps ?? 1090);
        if (payments) {
          financeInfo = { depositAmount, termMonths: fi.term, ...payments };
        }
      }

      const isCustomVan = !quote.vanId && !!(quote.customVanDescription || quote.customVanValue || quote.vanRegistration);
      const vanDetails = {
        make: van?.make ?? null,
        model: van?.model ?? null,
        year: van?.year ?? null,
        registration: quote.vanRegistration ?? van?.reg ?? null,
        mileage: (quote.vanMileage as number | null) ?? van?.mileage ?? null,
        transmission: van?.specs?.transmission ?? null,
        fuelType: van?.specs?.fuel ?? null,
        title: van?.title ?? null,
        isCustom: isCustomVan,
        customDescription: quote.customVanDescription ?? quote.vanRegistration ?? null,
      };

      const { sendDepotInvoiceEmail } = await import('./email.js');
      type DepotUpgrade = { id: string; name: string; [key: string]: unknown };
      const quoteCustomExtras = quote.customExtras ?? [];

      await sendDepotInvoiceEmail({
        quoteId: quote.id,
        customerName: quote.userName,
        customerPhone: quote.phone ?? null,
        customerEmail: quote.email ?? null,
        vanDetails,
        kitName: kit?.name ?? null,
        upgradeNames: (await sortUpgradesByDisplayOrder(selectedUpgrades.filter(Boolean) as any[])).map((u: any) => u.name),
        customExtras: quoteCustomExtras,
        subtotal: quote.estSubtotal,
        vat: quote.estVAT,
        discount: discount > 0 ? discount : undefined,
        total: totalWithVat,
        financeInfo,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error sending depot invoice email:', error);
      res.status(500).json({ error: "Failed to send depot email" });
    }
  });

  // Send finance submission email to finance company
  app.post("/api/admin/quotes/:id/send-finance", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Get finance company email from site settings (env fallback; no partner
      // address is shipped with the white-label build)
      const settings = await storage.getSiteSettings();
      const financeEmail = settings.finance_company_email || process.env.FINANCE_COMPANY_EMAIL;
      if (!financeEmail) {
        return res.status(400).json({ error: "No finance company email configured. Set it in Admin → Settings first." });
      }

      // Fetch van, kit, upgrade details
      const [van, kit, selectedUpgrades] = await Promise.all([
        quote.vanId ? storage.getVan(quote.vanId) : Promise.resolve(null),
        quote.kitId ? storage.getKit(quote.kitId) : Promise.resolve(null),
        quote.selectedUpgradeIds && quote.selectedUpgradeIds.length > 0
          ? Promise.all(quote.selectedUpgradeIds.map((uid: string) => storage.getUpgrade(uid)))
          : Promise.resolve([]),
      ]);

      // estSubtotal + estVAT are already post-discount values stored at save time.
      // Use estDiscount and estTotal directly to avoid double-discounting.
      const discount = quote.estDiscount || 0;
      const totalAfterDiscount = quote.estTotal;
      const totalWithVat = totalAfterDiscount + discount; // pre-discount total for email display

      // Build finance details from saved financeInputs.
      // Admin saves nullify financePlanId, so fall back to the site-wide 10.9% HP APR
      // (same logic as the Finance Calculator in the admin UI).
      let financeDetails: {
        planType: string;
        apr: number;
        depositAmount: number;
        termMonths: number;
        monthlyPayment: number;
        weeklyPayment: number;
      } | undefined;

      if (quote.financeInputs?.deposit !== undefined && quote.financeInputs?.deposit !== null && quote.financeInputs?.term) {
        const depositAmount = quote.financeInputs.deposit;
        const termMonths = quote.financeInputs.term;
        const principal = totalAfterDiscount - depositAmount;

        // Prefer stored finance plan APR; fall back to the standard 10.9% HP rate
        let aprDecimal = 0.109;
        let planType = 'HP';
        if (quote.financePlanId) {
          const financePlan = await storage.getFinancePlan(quote.financePlanId);
          if (financePlan) {
            aprDecimal = financePlan.aprBps / 10000;
            planType = financePlan.type;
          }
        }

        if (principal > 0 && termMonths > 0) {
          const monthlyRate = aprDecimal / 12;
          let monthlyPayment: number;
          if (monthlyRate === 0) {
            monthlyPayment = Math.round(principal / termMonths);
          } else {
            const pv = Math.pow(1 + monthlyRate, termMonths);
            monthlyPayment = Math.round((principal * monthlyRate * pv) / (pv - 1));
          }
          const weeklyPayment = Math.round((monthlyPayment * 12) / 52);
          financeDetails = {
            planType,
            apr: aprDecimal * 100,
            depositAmount,
            termMonths,
            monthlyPayment,
            weeklyPayment,
          };
        }
      }

      const { sendFinanceSubmissionEmail } = await import('./email.js');
      await sendFinanceSubmissionEmail({
        financeCompanyEmail: financeEmail,
        customerName: quote.userName,
        customerPhone: quote.phone,
        customerEmail: quote.email,
        quoteId: quote.id,
        vanTitle: van?.title ?? null,
        vanRegistration: req.body.vanRegistration !== undefined ? req.body.vanRegistration : (quote.vanRegistration ?? null),
        vanMileage: req.body.vanMileage !== undefined ? req.body.vanMileage : (quote.vanMileage ?? null),
        kitName: kit?.name ?? null,
        kitPrice: kit?.price ?? null,
        upgrades: (await sortUpgradesByDisplayOrder(selectedUpgrades.filter(Boolean) as any[])).map((u: any) => ({ name: u.name, price: u.price })),
        customExtras: ((quote as any).customExtras as Array<{id:string;description:string;pricePence:number}>) || [],
        subtotal: quote.estSubtotal,
        vat: quote.estVAT,
        total: totalWithVat,
        discount: discount > 0 ? discount : undefined,
        financeDetails,
      });

      // Record when finance email was sent, persist reg/mileage, and add auto-audit note
      const financeUser = req.user as any;
      const financeAuthor = financeUser?.username || 'System';
      const financeUpdates: any = {
        financeSentAt: new Date(),
        status: 'awaiting_finance' as const,
        adminNotesHistory: [
          ...(quote.adminNotesHistory || []),
          { text: `Finance submission sent to ${financeEmail} for ${quote.userName}`, timestamp: new Date().toISOString(), author: financeAuthor }
        ],
      };
      if (req.body.vanRegistration !== undefined) financeUpdates.vanRegistration = req.body.vanRegistration;
      if (req.body.vanMileage !== undefined) financeUpdates.vanMileage = req.body.vanMileage;
      await storage.updateQuote(req.params.id, financeUpdates);

      res.json({ success: true, sentTo: financeEmail });
    } catch (error) {
      console.error('Error sending finance email:', error);
      res.status(500).json({ error: "Failed to send finance email" });
    }
  });

  // Send finance preview email to the logged-in admin's own email
  app.post("/api/admin/quotes/:id/send-finance-preview", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      // req.user is not populated by this app (no Passport) — look up the user via session
      const sessionUserId = (req.session as any)?.user?.id;
      const sessionUser = sessionUserId ? await storage.getUser(sessionUserId) : null;
      const recipientEmail: string = req.body.previewEmail?.trim() || sessionUser?.email || "";
      if (!recipientEmail) {
        return res.status(400).json({ error: "Please enter an email address to send the preview to." });
      }

      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      const [van, kit, selectedUpgrades] = await Promise.all([
        quote.vanId ? storage.getVan(quote.vanId) : Promise.resolve(null),
        quote.kitId ? storage.getKit(quote.kitId) : Promise.resolve(null),
        quote.selectedUpgradeIds && quote.selectedUpgradeIds.length > 0
          ? Promise.all(quote.selectedUpgradeIds.map((uid: string) => storage.getUpgrade(uid)))
          : Promise.resolve([]),
      ]);

      // estSubtotal + estVAT are already post-discount values stored at save time.
      // Use estDiscount and estTotal directly to avoid double-discounting.
      const discount = quote.estDiscount || 0;
      const totalAfterDiscount = quote.estTotal;
      const totalWithVat = totalAfterDiscount + discount; // pre-discount total for email display

      let financeDetails: {
        planType: string;
        apr: number;
        depositAmount: number;
        termMonths: number;
        monthlyPayment: number;
        weeklyPayment: number;
      } | undefined;

      if (quote.financeInputs?.deposit !== undefined && quote.financeInputs?.deposit !== null && quote.financeInputs?.term) {
        const depositAmount = quote.financeInputs.deposit;
        const termMonths = quote.financeInputs.term;
        const principal = totalAfterDiscount - depositAmount;

        let aprDecimal = 0.109;
        let planType = 'HP';
        if (quote.financePlanId) {
          const financePlan = await storage.getFinancePlan(quote.financePlanId);
          if (financePlan) {
            aprDecimal = financePlan.aprBps / 10000;
            planType = financePlan.type;
          }
        }

        if (principal > 0 && termMonths > 0) {
          const monthlyRate = aprDecimal / 12;
          let monthlyPayment: number;
          if (monthlyRate === 0) {
            monthlyPayment = Math.round(principal / termMonths);
          } else {
            const pv = Math.pow(1 + monthlyRate, termMonths);
            monthlyPayment = Math.round((principal * monthlyRate * pv) / (pv - 1));
          }
          const weeklyPayment = Math.round((monthlyPayment * 12) / 52);
          financeDetails = {
            planType,
            apr: aprDecimal * 100,
            depositAmount,
            termMonths,
            monthlyPayment,
            weeklyPayment,
          };
        }
      }

      const { sendFinanceSubmissionEmail } = await import('./email.js');
      await sendFinanceSubmissionEmail({
        financeCompanyEmail: recipientEmail,
        customerName: quote.userName,
        customerPhone: quote.phone,
        customerEmail: quote.email,
        quoteId: quote.id,
        vanTitle: van?.title ?? null,
        vanRegistration: req.body.vanRegistration !== undefined ? req.body.vanRegistration : (quote.vanRegistration ?? null),
        vanMileage: req.body.vanMileage !== undefined ? req.body.vanMileage : (quote.vanMileage ?? null),
        kitName: kit?.name ?? null,
        kitPrice: kit?.price ?? null,
        upgrades: (await sortUpgradesByDisplayOrder(selectedUpgrades.filter(Boolean) as any[])).map((u: any) => ({ name: u.name, price: u.price })),
        customExtras: ((quote as any).customExtras as Array<{id:string;description:string;pricePence:number}>) || [],
        subtotal: quote.estSubtotal,
        vat: quote.estVAT,
        total: totalWithVat,
        discount: discount > 0 ? discount : undefined,
        financeDetails,
      });

      res.json({ success: true, sentTo: recipientEmail });
    } catch (error) {
      console.error('Error sending finance preview email:', error);
      res.status(500).json({ error: "Failed to send finance preview email" });
    }
  });

  // Public quote confirmation endpoint (no auth required)
  app.get("/api/quote/confirm/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const quotes = await storage.getQuotes();
      const quote = quotes.find(q => q.confirmationToken === token);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found or link expired" });
      }

      // Fetch related data for full configuration details
      let van = null;
      let kit = null;
      let upgrades: any[] = [];
      let financePlan = null;

      if (quote.vanId) {
        van = await storage.getVan(quote.vanId);
      }

      if (quote.kitId) {
        kit = await storage.getKit(quote.kitId);
      }

      if (quote.selectedUpgradeIds && quote.selectedUpgradeIds.length > 0) {
        upgrades = await Promise.all(
          quote.selectedUpgradeIds.map(id => storage.getUpgrade(id))
        );
        // Filter out nulls and add quantity info
        upgrades = upgrades.filter(Boolean).map(upgrade => ({
          ...upgrade,
          quantity: quote.selectedUpgrades[upgrade.id] || 1
        }));
      }

      if (quote.financePlanId) {
        financePlan = await storage.getFinancePlan(quote.financePlanId);
      }

      // Enrich comparison config slots with human-readable names if present
      let enrichedComparisonForCustomer: {
        slotA: {
          vanTitle?: string | null;
          vanRegistration?: string | null;
          customVanDescription?: string | null;
          kitName?: string | null;
          upgradeNames?: string[];
          trainingOptionNames?: string[];
          estSubtotal?: number;
          estVAT?: number;
          estTotal?: number;
        } | null;
        slotB: {
          vanTitle?: string | null;
          vanRegistration?: string | null;
          customVanDescription?: string | null;
          kitName?: string | null;
          upgradeNames?: string[];
          trainingOptionNames?: string[];
          estSubtotal?: number;
          estVAT?: number;
          estTotal?: number;
        } | null;
      } | null = null;

      if (quote.comparisonConfig) {
        const enrichSlot = async (slot: {
          vanId?: string | null;
          customVanDescription?: string | null;
          vanRegistration?: string | null;
          kitId?: string | null;
          upgradeIds?: string[];
          trainingOptionIds?: string[];
          estSubtotal?: number;
          estVAT?: number;
          estTotal?: number;
        }) => {
          const [slotVan, slotKit, slotUpgrades, slotTraining] = await Promise.all([
            slot.vanId ? storage.getVan(slot.vanId) : Promise.resolve(null),
            slot.kitId ? storage.getKit(slot.kitId) : Promise.resolve(null),
            (slot.upgradeIds || []).length > 0
              ? Promise.all((slot.upgradeIds || []).map((uid) => storage.getUpgrade(uid)))
              : Promise.resolve([]),
            (slot.trainingOptionIds || []).length > 0
              ? Promise.all((slot.trainingOptionIds || []).map((tid) => storage.getTrainingOption(tid)))
              : Promise.resolve([]),
          ]);
          return {
            vanTitle: slotVan?.title ?? null,
            vanRegistration: slot.vanRegistration ?? null,
            customVanDescription: slot.customVanDescription ?? null,
            kitName: slotKit?.name ?? null,
            upgradeNames: (await sortUpgradesByDisplayOrder(slotUpgrades.filter(Boolean) as any[])).map((u: any) => u.name),
            trainingOptionNames: slotTraining.filter(Boolean).map((t: any) => t.name),
            estSubtotal: slot.estSubtotal,
            estVAT: slot.estVAT,
            estTotal: slot.estTotal,
          };
        };

        const [enrichedSlotA, enrichedSlotB] = await Promise.all([
          enrichSlot(quote.comparisonConfig.slotA),
          enrichSlot(quote.comparisonConfig.slotB),
        ]);

        enrichedComparisonForCustomer = {
          slotA: enrichedSlotA,
          slotB: enrichedSlotB,
        };
      }

      // Return full configuration details (no internal admin fields)
      const customerSafeQuote = {
        id: quote.id,
        userName: quote.userName,
        email: quote.email,
        phone: quote.phone,
        company: quote.company,
        van,
        kit,
        upgrades,
        financePlan,
        financeInputs: quote.financeInputs,
        estSubtotal: quote.estSubtotal,
        estVAT: quote.estVAT,
        estTotal: quote.estTotal,
        estDiscount: quote.estDiscount,
        discountType: quote.discountType,
        discountValue: quote.discountValue,
        customerNotesHistory: quote.customerNotesHistory, // Only customer notes history, NOT adminNotesHistory
        status: quote.status,
        createdAt: quote.createdAt,
        confirmedAt: quote.confirmedAt,
        comparisonConfig: enrichedComparisonForCustomer,
        chosenOption: quote.chosenOption ?? null,
      };

      res.json(customerSafeQuote);
    } catch (error) {
      console.error('Error fetching quote by token:', error);
      res.status(500).json({ error: "Failed to fetch quote" });
    }
  });

  // Confirm quote (public endpoint)
  app.post("/api/quote/confirm/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const quotes = await storage.getQuotes();
      const quote = quotes.find(q => q.confirmationToken === token);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found or link expired" });
      }

      // Check if already confirmed to prevent replay
      if ((quote.status === 'deposit_taken' || quote.status === 'in_build' || quote.status === 'completed') && quote.confirmedAt) {
        return res.json({ success: true, alreadyConfirmed: true });
      }

      // Update quote to deposit_taken status and clear token (one-time use)
      const updated = await storage.updateQuote(quote.id, {
        status: 'deposit_taken' as const,
        confirmedAt: new Date(),
        confirmationToken: null, // Clear token to prevent reuse
      });

      if (!updated) {
        return res.status(500).json({ error: "Failed to confirm quote" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error confirming quote:', error);
      res.status(500).json({ error: "Failed to confirm quote" });
    }
  });

  // Customer submits corrections to their quote (public endpoint, token-gated)
  app.post("/api/quote/correct/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { corrections } = req.body;

      if (!corrections || typeof corrections !== 'string' || !corrections.trim()) {
        return res.status(400).json({ error: "Corrections text is required" });
      }

      const quotes = await storage.getQuotes();
      const quote = quotes.find(q => q.confirmationToken === token);

      if (!quote) {
        return res.status(404).json({ error: "Quote not found or link expired" });
      }

      const newNote = {
        text: `Customer correction request:\n${corrections.trim()}`,
        timestamp: new Date().toISOString(),
        author: "Customer",
      };

      const updatedHistory = [...(quote.adminNotesHistory || []), newNote];

      await storage.updateQuote(quote.id, {
        adminNotesHistory: updatedHistory,
      });

      // Notify internal team
      try {
        const { sendEmail, isTestEmail, getInternalNotifyEmails } = await import('./email.js');
        if (isTestEmail(quote.email)) { /* suppress for e2e test addresses */ } else
        await sendEmail({
          to: await getInternalNotifyEmails('quote_correction'),
          subject: `Quote Correction Request — ${quote.userName}`,
          html: `
            <h2>A customer has requested corrections to their quote</h2>
            <p><strong>Customer:</strong> ${quote.userName}</p>
            <p><strong>Email:</strong> ${quote.email}</p>
            <p><strong>Quote ID:</strong> ${quote.id}</p>
            <hr/>
            <h3>Their corrections:</h3>
            <p style="white-space:pre-wrap; background:#f5f5f5; padding:12px; border-radius:6px;">${corrections.trim()}</p>
            <hr/>
            <p>Please review the quote in the admin panel and make any necessary adjustments.</p>
          `,
        });
      } catch (emailErr) {
        console.error('Failed to send correction notification email:', emailErr);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error saving quote correction:', error);
      res.status(500).json({ error: "Failed to save corrections" });
    }
  });

  // ── AutoTradeOS: stock level webhook receiver (public, secret-validated) ──────
  app.post("/api/webhooks/autotradeos/stock-update", async (req, res) => {
    try {
      const secret = process.env.AUTOTRADEOS_WEBHOOK_SECRET;
      if (!secret || req.headers["x-webhook-secret"] !== secret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const schema = z.object({
        items: z.array(z.object({
          sku: z.string(),
          stock_qty: z.number().int(),
        })),
      });
      const { items } = schema.parse(req.body);
      for (const item of items) {
        await pool.query(
          `INSERT INTO sku_stock_levels (sku, stock_qty, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (sku) DO UPDATE SET stock_qty = $2, updated_at = NOW()`,
          [item.sku, item.stock_qty]
        );
      }
      res.json({ ok: true, updated: items.length });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid payload" });
      console.error("AutoTradeOS stock webhook error:", err);
      res.status(500).json({ error: "Failed to update stock levels" });
    }
  });

  // Public spec approval — get quote info by approval token
  app.get("/api/spec-approval/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const quotes = await storage.getQuotes();
      const quote = (quotes as any[]).find(q => q.approvalToken === token);
      if (!quote) {
        return res.status(404).json({ error: "Approval link not found or has expired" });
      }
      // Return only safe fields needed for the approval page
      const ref = quote.id.slice(0, 8).toUpperCase();

      // Resolve upgrade names and quantities from selectedUpgrades (Record<id, qty>)
      const selectedUpgradesMap: Record<string, number> = (quote.selectedUpgrades as Record<string, number>) || {};
      const upgradeIds = Object.keys(selectedUpgradesMap);
      let upgradesWithQty: Array<{ name: string; quantity: number }> = [];
      if (upgradeIds.length > 0) {
        const allUpgrades = await storage.getUpgrades();
        const sorted = await sortUpgradesByDisplayOrder(
          allUpgrades.filter(u => upgradeIds.includes(u.id))
        );
        upgradesWithQty = sorted.map(u => ({
          name: u.variantName ? `${u.name} — ${u.variantName}` : u.name,
          quantity: selectedUpgradesMap[u.id] ?? 1,
        }));
      }

      res.json({
        ref,
        customerName: quote.userName,
        specApprovalStatus: quote.specApprovalStatus || null,
        specApprovalComments: quote.specApprovalComments || null,
        upgrades: upgradesWithQty,
      });
    } catch (error) {
      console.error('Error fetching spec approval:', error);
      res.status(500).json({ error: "Failed to fetch approval info" });
    }
  });

  // Public spec approval — submit customer approval or rejection
  app.post("/api/spec-approval/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { status, comments } = req.body;

      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
      }
      if (status === 'rejected' && (!comments || !comments.trim())) {
        return res.status(400).json({ error: "Please describe what needs changing" });
      }

      const quotes = await storage.getQuotes();
      const quote = (quotes as any[]).find(q => q.approvalToken === token);
      if (!quote) {
        return res.status(404).json({ error: "Approval link not found or has expired" });
      }

      const auditNote = {
        text: status === 'approved'
          ? `Customer confirmed the spec is correct`
          : `Customer flagged spec as incorrect: "${comments.trim()}"`,
        timestamp: new Date().toISOString(),
        author: 'Customer',
      };

      await storage.updateQuote(quote.id, {
        specApprovalStatus: status,
        specApprovalComments: status === 'rejected' ? comments.trim() : null,
        adminNotesHistory: [...(quote.adminNotesHistory || []), auditNote],
      } as any);

      // Notify internal team
      const ref = quote.id.slice(0, 8).toUpperCase();
      try {
        const { sendEmail, isTestEmail, getInternalNotifyEmails } = await import('./email.js');
        const INTERNAL_NOTIFY_EMAILS = await getInternalNotifyEmails('spec_approval');
        if (isTestEmail(quote.email)) { /* suppress for e2e test addresses */ } else {
        const subject = status === 'approved'
          ? `Spec Approved — ${quote.userName} (Ref #${ref})`
          : `Spec Flagged as Incorrect — ${quote.userName} (Ref #${ref})`;
        const html = status === 'approved'
          ? `<h2>Customer confirmed their spec is correct</h2>
             <p><strong>Customer:</strong> ${quote.userName}</p>
             <p><strong>Email:</strong> ${quote.email}</p>
             <p><strong>Reference:</strong> #${ref}</p>
             <p style="color:#166534;">The customer is happy with their specification.</p>`
          : `<h2>Customer flagged their spec as incorrect</h2>
             <p><strong>Customer:</strong> ${quote.userName}</p>
             <p><strong>Email:</strong> ${quote.email}</p>
             <p><strong>Reference:</strong> #${ref}</p>
             <hr/>
             <h3>Customer's comments:</h3>
             <p style="white-space:pre-wrap; background:#fef2f2; padding:12px; border-radius:6px; border-left:4px solid #ef4444;">${comments.trim()}</p>
             <hr/>
             <p>Please review and update the quote in the admin panel.</p>`;
        await sendEmail({ to: INTERNAL_NOTIFY_EMAILS, subject, html });
        } // end isTestEmail guard
      } catch (emailErr) {
        console.error('Failed to send spec approval notification:', emailErr);
      }

      res.json({ success: true, status });
    } catch (error) {
      console.error('Error saving spec approval:', error);
      res.status(500).json({ error: "Failed to save approval" });
    }
  });

  // Recent enquiries feed — combined leads + quotes sorted by createdAt desc
  app.get("/api/admin/enquiries/recent", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const [allLeads, allQuotes, allVans, allKits] = await Promise.all([
        storage.getLeads(),
        storage.getQuotes(),
        storage.getVans(),
        storage.getKits(),
      ]);

      const vanMap = new Map(allVans.map(v => [v.id, v.title || `${v.make} ${v.model}`]));
      const kitMap = new Map(allKits.map(k => [k.id, k.name]));

      // Today's start (midnight UTC) for unread badge counting
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Full counts across all items (not limited) so badge is always accurate
      const todayNewLeadCount = allLeads.filter(
        l => l.status === "new" && l.createdAt && new Date(l.createdAt) >= todayStart
      ).length;
      const todayNewQuoteCount = allQuotes.filter(
        q => q.status === "new" && q.createdAt && new Date(q.createdAt) >= todayStart
      ).length;

      const recentLeads = allLeads
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, limit)
        .map(l => ({
          kind: "lead" as const,
          id: l.id,
          name: l.name,
          phone: l.phone ?? null,
          email: l.email,
          source: l.source,
          status: l.status,
          createdAt: l.createdAt,
        }));

      const recentQuotes = allQuotes
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, limit)
        .map(q => ({
          kind: "quote" as const,
          id: q.id,
          name: q.userName,
          phone: q.phone ?? null,
          email: q.email,
          source: "configurator",
          status: q.status,
          createdAt: q.createdAt,
          vanTitle: q.vanId ? (vanMap.get(q.vanId) ?? null) : (q.customVanDescription ?? null),
          kitName: q.kitId ? (kitMap.get(q.kitId) ?? null) : null,
          estTotal: q.estTotal,
        }));

      res.json({
        leads: recentLeads,
        quotes: recentQuotes,
        todayNewLeadCount,
        todayNewQuoteCount,
      });
    } catch (error) {
      console.error("GET /api/admin/enquiries/recent error:", error);
      res.status(500).json({ error: "Failed to fetch recent enquiries" });
    }
  });

  app.get("/api/admin/leads", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const leads = await storage.getLeads();
      // Collect unique customer IDs and fetch their names in one query
      const customerIds = [...new Set(leads.map(l => l.customerId).filter(Boolean))] as string[];
      let customerNames: Record<string, string> = {};
      if (customerIds.length > 0) {
        const placeholders = customerIds.map((_, i) => `$${i + 1}`).join(", ");
        const { rows } = await pool.query<{ id: string; name: string }>(
          `SELECT id, name FROM customers WHERE id IN (${placeholders})`,
          customerIds
        );
        customerNames = Object.fromEntries(rows.map(r => [r.id, r.name]));
      }
      const result = leads.map(l => ({
        ...l,
        customerName: l.customerId ? (customerNames[l.customerId] ?? null) : null,
      }));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.patch("/api/admin/leads/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { status, crmNotes, quoteId, email, phone, name, customerId } = req.body;
      const updateData: Record<string, any> = {};
      if (status !== undefined) updateData.status = status;
      if (crmNotes !== undefined) updateData.crmNotes = crmNotes;
      if (quoteId !== undefined) updateData.quoteId = quoteId;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (name !== undefined) updateData.name = name;
      if (customerId !== undefined) updateData.customerId = customerId;

      // Stamp statusChangedAt whenever status is explicitly changed
      if (status !== undefined) {
        const current = await storage.getLead(req.params.id);
        if (current && current.status !== status) {
          updateData.statusChangedAt = new Date();
        }
      }

      const updated = await storage.updateLead(req.params.id, updateData);
      if (!updated) return res.status(404).json({ error: "Lead not found" });
      res.json(updated);

      // Re-link customer if contact details changed (skip if customerId was explicitly set)
      if (customerId === undefined && (email !== undefined || phone !== undefined || name !== undefined)) {
        const effectiveEmail = (email ?? updated.email ?? null) as string | null;
        const effectivePhone = (phone ?? updated.phone ?? null) as string | null;
        const effectiveName = (name ?? updated.name ?? "Unknown") as string;
        if (effectiveEmail || effectivePhone) {
          storage.findOrCreateCustomer(effectiveEmail, effectivePhone, effectiveName)
            .then(customer =>
              storage.linkLeadToCustomer(updated.id, customer.id, "System (auto-link)")
                .then(() => storage.backfillLeadsAndQuotesForCustomer(customer.id, effectiveEmail, effectivePhone))
            )
            .catch(err => console.error("Customer re-link (lead update):", err?.message));
        }
      }
    } catch (error) {
      console.error('PATCH /api/admin/leads/:id error:', error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // ── Follow-ups ────────────────────────────────────────────────────────────────
  app.get("/api/admin/follow-ups/today", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const followUps = await storage.getTodayFollowUps();
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch today's follow-ups" });
    }
  });

  app.get("/api/admin/follow-ups", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { quoteId } = req.query;
      const followUps = quoteId
        ? await storage.getFollowUpsByQuote(quoteId as string)
        : await storage.getFollowUps();
      res.json(followUps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch follow-ups" });
    }
  });

  app.post("/api/admin/follow-ups", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { customerName, scheduledDate } = req.body;
      if (!customerName || !scheduledDate) {
        return res.status(400).json({ error: "customerName and scheduledDate are required" });
      }
      const followUp = await storage.createFollowUp(req.body);
      res.json(followUp);
    } catch (error) {
      res.status(500).json({ error: "Failed to create follow-up" });
    }
  });

  app.patch("/api/admin/follow-ups/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const data = req.body;
      if (data.completed === true && !data.completedAt) {
        data.completedAt = new Date();
      }
      const followUp = await storage.updateFollowUp(req.params.id, data);
      if (!followUp) return res.status(404).json({ error: "Follow-up not found" });
      res.json(followUp);
    } catch (error) {
      res.status(500).json({ error: "Failed to update follow-up" });
    }
  });

  app.delete("/api/admin/follow-ups/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      await storage.deleteFollowUp(req.params.id);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete follow-up" });
    }
  });

  // Analytics endpoint
  app.get("/api/admin/analytics", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const [quotes, leads, vans, popularityIntel] = await Promise.all([
        storage.getQuotes(),
        storage.getLeads(),
        storage.getVans(),
        computePopularityIntelligence().catch(() => null),
      ]);

      // Calculate metrics
      const totalQuotes = quotes.length;
      const totalLeads = leads.length;
      const totalVans = vans.length;
      const publishedVans = vans.filter(v => v.published).length;

      // Quote status breakdown
      const quotesByStatus = quotes.reduce((acc, quote) => {
        acc[quote.status] = (acc[quote.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentQuotes = quotes.filter(q => 
        q.createdAt && new Date(q.createdAt) > sevenDaysAgo
      ).length;
      
      const recentLeads = leads.filter(l => 
        l.createdAt && new Date(l.createdAt) > sevenDaysAgo
      ).length;

      // Most popular vans (by quote selections)
      const vanPopularity = quotes.reduce((acc, quote) => {
        if (quote.vanId) {
          acc[quote.vanId] = (acc[quote.vanId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const popularVans = Object.entries(vanPopularity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([vanId, count]) => {
          const van = vans.find(v => v.id === vanId);
          return {
            vanId,
            title: van?.title || 'Unknown',
            count
          };
        });

      // Most popular kits
      const kitPopularity = quotes.reduce((acc, quote) => {
        if (quote.kitId) {
          acc[quote.kitId] = (acc[quote.kitId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const popularKits = Object.entries(kitPopularity)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([kitId, count]) => ({
          kitId,
          count
        }));

      res.json({
        overview: {
          totalQuotes,
          totalLeads,
          totalVans,
          publishedVans,
          recentQuotes,
          recentLeads
        },
        quotesByStatus,
        popularVans,
        popularKits,
        volumeSegments: popularityIntel?.volumeSegments ?? [],
        popularity: {
          totalMeaningfulQuotes: popularityIntel?.totalMeaningfulQuotes ?? 0,
          allKits: popularityIntel?.allKits ?? [],
          allUpgradesOverall: popularityIntel?.allUpgradesOverall ?? [],
          rate48v: popularityIntel?.rate48v ?? 0,
          packageTierDistribution: popularityIntel?.packageTierDistribution ?? [],
          dominantPackageTier: popularityIntel?.dominantPackageTier ?? null,
          volumeSegments: popularityIntel?.volumeSegments ?? [],
        },
        recentActivity: {
          quotes: quotes
            .sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            })
            .slice(0, 5)
            .map(q => ({
              id: q.id,
              customerName: q.userName,
              customerEmail: q.email,
              status: q.status,
              totalPrice: q.estTotal,
              createdAt: q.createdAt
            })),
          leads: leads
            .sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            })
            .slice(0, 5)
            .map(l => ({
              id: l.id,
              name: l.name,
              email: l.email,
              message: l.message,
              createdAt: l.createdAt
            }))
        }
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ============================================================
  // Web Analytics Collection (public endpoints, no auth required)
  // ============================================================

  // Helper to hash IP for GDPR compliance
  const hashIp = (ip: string): string => {
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
      hash = ((hash << 5) - hash) + ip.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  };

  // POST /api/analytics/session - create or update a visitor session
  app.post("/api/analytics/session", async (req, res) => {
    try {
      const { sessionId, userAgent, deviceType, browser, os, referrer, utmSource, utmMedium, utmCampaign, utmTerm, utmContent, entryPage } = req.body;
      if (!sessionId) return res.json({ ok: false });

      const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
      const ipHash = hashIp(ip);

      // Detect if this request is from a logged-in admin — exclude from customer analytics
      const sessionUser = (req.session as any)?.user;
      const isAdmin = !!(sessionUser?.id);

      // Upsert session
      await pool.query(`
        INSERT INTO analytics_sessions (session_id, user_agent, device_type, browser, os, ip_hash, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content, entry_page, is_admin, last_seen_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (session_id) DO UPDATE SET last_seen_at = NOW(), is_admin = GREATEST(analytics_sessions.is_admin, $14)
      `, [sessionId, userAgent, deviceType, browser, os, ipHash, referrer, utmSource, utmMedium, utmCampaign, utmTerm, utmContent, entryPage, isAdmin]);

      res.json({ ok: true });
    } catch (error) {
      console.error("Analytics session error:", error);
      res.json({ ok: false });
    }
  });

  // POST /api/analytics/mark-admin - mark the current analytics session as
  // admin traffic. Requires a logged-in user so anonymous visitors can't
  // hide their traffic from analytics.
  app.post("/api/analytics/mark-admin", isAuthenticated, async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) return res.json({ ok: false });
      await pool.query(`UPDATE analytics_sessions SET is_admin = TRUE WHERE session_id = $1`, [sessionId]);
      res.json({ ok: true });
    } catch (error) {
      res.json({ ok: false });
    }
  });

  // POST /api/analytics/pageview - record a page view
  app.post("/api/analytics/pageview", async (req, res) => {
    try {
      const { sessionId, url, title, referrer } = req.body;
      if (!sessionId || !url) return res.json({ ok: false });

      const sessionUser = (req.session as any)?.user;
      const isAdmin = !!(sessionUser?.id);

      await pool.query(`
        INSERT INTO analytics_pageviews (session_id, url, title, referrer)
        VALUES ($1, $2, $3, $4)
      `, [sessionId, url, title, referrer]);

      // Update session: increment page count, set bounce=false if more than 1 page, update exit page
      // Also ensure is_admin is set if this is an admin browsing
      await pool.query(`
        UPDATE analytics_sessions
        SET page_count = page_count + 1,
            bounce = (page_count + 1 <= 1),
            exit_page = $2,
            last_seen_at = NOW(),
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
            is_admin = GREATEST(is_admin, $3)
        WHERE session_id = $1
      `, [sessionId, url, isAdmin]);

      res.json({ ok: true });
    } catch (error) {
      console.error("Analytics pageview error:", error);
      res.json({ ok: false });
    }
  });

  // POST /api/analytics/event - record a custom event
  app.post("/api/analytics/event", async (req, res) => {
    try {
      const { sessionId, eventName, eventData, url } = req.body;
      if (!sessionId || !eventName) return res.json({ ok: false });

      const sessionUser = (req.session as any)?.user;
      const isAdmin = !!(sessionUser?.id);

      await pool.query(`
        INSERT INTO analytics_events (session_id, event_name, event_data, url)
        VALUES ($1, $2, $3, $4)
      `, [sessionId, eventName, JSON.stringify(eventData || {}), url]);

      // Update session last seen and admin status
      await pool.query(`
        UPDATE analytics_sessions SET last_seen_at = NOW(), duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER, is_admin = GREATEST(is_admin, $2) WHERE session_id = $1
      `, [sessionId, isAdmin]);

      res.json({ ok: true });
    } catch (error) {
      console.error("Analytics event error:", error);
      res.json({ ok: false });
    }
  });

  // ============================================================
  // Configurator Date-Range Analytics Endpoint
  // ============================================================
  app.get("/api/admin/analytics/configurators", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const fromParam = req.query.from as string;
      const toParam = req.query.to as string;

      const quotes = await storage.getQuotes();

      const fromDate = fromParam ? new Date(fromParam) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
      const toDate = toParam ? new Date(toParam) : new Date();
      // normalise toDate to end of day
      toDate.setHours(23, 59, 59, 999);

      const filtered = quotes.filter(q => {
        if (!q.createdAt) return false;
        const d = new Date(q.createdAt);
        return d >= fromDate && d <= toDate;
      });

      // Group by date (YYYY-MM-DD)
      const byDay: Record<string, { total: number; byStatus: Record<string, number> }> = {};
      filtered.forEach(q => {
        const day = new Date(q.createdAt!).toISOString().slice(0, 10);
        if (!byDay[day]) byDay[day] = { total: 0, byStatus: {} };
        byDay[day].total++;
        byDay[day].byStatus[q.status] = (byDay[day].byStatus[q.status] || 0) + 1;
      });

      // Fill in every date in range with 0 if missing
      const daily: Array<{ date: string; total: number; byStatus: Record<string, number> }> = [];
      const cursor = new Date(fromDate);
      cursor.setHours(0, 0, 0, 0);
      const end = new Date(toDate);
      end.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        const day = cursor.toISOString().slice(0, 10);
        daily.push({ date: day, total: byDay[day]?.total ?? 0, byStatus: byDay[day]?.byStatus ?? {} });
        cursor.setDate(cursor.getDate() + 1);
      }

      // Status totals across range
      const statusTotals: Record<string, number> = {};
      filtered.forEach(q => {
        statusTotals[q.status] = (statusTotals[q.status] || 0) + 1;
      });

      res.json({
        total: filtered.length,
        daily,
        statusTotals,
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
      });
    } catch (error) {
      console.error("GET /api/admin/analytics/configurators error:", error);
      res.status(500).json({ message: "Failed to fetch configurator analytics" });
    }
  });

  // ============================================================
  // Web Analytics Admin Query Endpoint
  // ============================================================
  app.get("/api/admin/analytics/web", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString();

      // All session queries exclude admin traffic so stats reflect real customers only
      const EXCL_ADMIN = "AND NOT is_admin";

      // Overview stats
      const [sessionsResult, pageviewsResult, avgDurationResult, bounceResult] = await Promise.all([
        pool.query(`SELECT COUNT(*) as count FROM analytics_sessions WHERE started_at >= $1 ${EXCL_ADMIN}`, [cutoffStr]),
        pool.query(`SELECT COUNT(*) as count FROM analytics_pageviews pv JOIN analytics_sessions s ON pv.session_id = s.session_id WHERE pv.created_at >= $1 ${EXCL_ADMIN}`, [cutoffStr]),
        pool.query(`SELECT AVG(duration_seconds) as avg FROM analytics_sessions WHERE started_at >= $1 AND duration_seconds IS NOT NULL ${EXCL_ADMIN}`, [cutoffStr]),
        pool.query(`SELECT COUNT(*) FILTER (WHERE bounce = true) as bounced, COUNT(*) as total FROM analytics_sessions WHERE started_at >= $1 ${EXCL_ADMIN}`, [cutoffStr]),
      ]);

      const totalSessions = parseInt(sessionsResult.rows[0].count);
      const totalPageviews = parseInt(pageviewsResult.rows[0].count);
      const avgDuration = Math.round(parseFloat(avgDurationResult.rows[0].avg) || 0);
      const bounceData = bounceResult.rows[0];
      const bounceRate = bounceData.total > 0 ? Math.round((bounceData.bounced / bounceData.total) * 100) : 0;

      // Daily visitors (last N days)
      const dailyResult = await pool.query(`
        SELECT
          DATE(started_at) as date,
          COUNT(*) as sessions,
          SUM(page_count) as pageviews
        FROM analytics_sessions
        WHERE started_at >= $1 ${EXCL_ADMIN}
        GROUP BY DATE(started_at)
        ORDER BY date ASC
      `, [cutoffStr]);

      // Traffic sources
      const trafficResult = await pool.query(`
        SELECT
          CASE
            WHEN utm_medium = 'cpc' OR utm_medium = 'paid' OR utm_medium = 'ppc' THEN 'Paid Search'
            WHEN utm_source IS NOT NULL AND utm_source != '' THEN 'Campaign'
            WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
            WHEN referrer ~* '(google\\.com|bing\\.com|yahoo\\.com|duckduckgo\\.com|baidu\\.com|yandex\\.com)' THEN 'Organic Search'
            WHEN referrer ~* '(facebook\\.com|instagram\\.com|twitter\\.com|x\\.com|linkedin\\.com|tiktok\\.com|pinterest\\.com|reddit\\.com|youtube\\.com)' THEN 'Social'
            ELSE 'Referral'
          END as source,
          COUNT(*) as count
        FROM analytics_sessions
        WHERE started_at >= $1 ${EXCL_ADMIN}
        GROUP BY 1
        ORDER BY count DESC
      `, [cutoffStr]);

      // Top pages
      const topPagesResult = await pool.query(`
        SELECT pv.url, COUNT(*) as views, COUNT(DISTINCT pv.session_id) as unique_visitors
        FROM analytics_pageviews pv
        JOIN analytics_sessions s ON pv.session_id = s.session_id
        WHERE pv.created_at >= $1 AND NOT s.is_admin
        GROUP BY pv.url
        ORDER BY views DESC
        LIMIT 20
      `, [cutoffStr]);

      // Device breakdown
      const devicesResult = await pool.query(`
        SELECT COALESCE(device_type, 'Unknown') as device, COUNT(*) as count
        FROM analytics_sessions
        WHERE started_at >= $1 ${EXCL_ADMIN}
        GROUP BY device_type
        ORDER BY count DESC
      `, [cutoffStr]);

      // Browser breakdown
      const browsersResult = await pool.query(`
        SELECT COALESCE(browser, 'Unknown') as browser, COUNT(*) as count
        FROM analytics_sessions
        WHERE started_at >= $1 ${EXCL_ADMIN}
        GROUP BY browser
        ORDER BY count DESC
        LIMIT 10
      `, [cutoffStr]);

      // OS breakdown
      const osResult = await pool.query(`
        SELECT COALESCE(os, 'Unknown') as os, COUNT(*) as count
        FROM analytics_sessions
        WHERE started_at >= $1 ${EXCL_ADMIN}
        GROUP BY os
        ORDER BY count DESC
        LIMIT 10
      `, [cutoffStr]);

      // Top events
      const eventsResult = await pool.query(`
        SELECT ae.event_name, COUNT(*) as count
        FROM analytics_events ae
        JOIN analytics_sessions s ON ae.session_id = s.session_id
        WHERE ae.created_at >= $1 AND NOT s.is_admin
        GROUP BY ae.event_name
        ORDER BY count DESC
        LIMIT 15
      `, [cutoffStr]);

      // UTM Campaigns
      const campaignsResult = await pool.query(`
        SELECT
          COALESCE(utm_source, 'unknown') as source,
          COALESCE(utm_medium, 'unknown') as medium,
          COALESCE(utm_campaign, 'unknown') as campaign,
          COUNT(*) as sessions,
          SUM(page_count) as pageviews,
          AVG(duration_seconds)::INTEGER as avg_duration
        FROM analytics_sessions
        WHERE started_at >= $1 AND utm_source IS NOT NULL AND utm_source != '' ${EXCL_ADMIN}
        GROUP BY utm_source, utm_medium, utm_campaign
        ORDER BY sessions DESC
        LIMIT 20
      `, [cutoffStr]);

      // Recent sessions (exclude admin sessions)
      const recentSessionsResult = await pool.query(`
        SELECT session_id, device_type, browser, os, referrer, entry_page, exit_page, page_count, bounce, duration_seconds, utm_source, utm_medium, utm_campaign, started_at, last_seen_at
        FROM analytics_sessions
        WHERE NOT is_admin
        ORDER BY started_at DESC
        LIMIT 50
      `);

      // Top referrers
      const referrersResult = await pool.query(`
        SELECT
          COALESCE(
            CASE
              WHEN referrer ~ '^https?://([^/]+)' THEN regexp_replace(referrer, '^https?://([^/?#]+).*', '\\1')
              ELSE referrer
            END,
            'Direct'
          ) as domain,
          COUNT(*) as count
        FROM analytics_sessions
        WHERE started_at >= $1 AND referrer IS NOT NULL AND referrer != '' ${EXCL_ADMIN}
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 15
      `, [cutoffStr]);

      res.json({
        overview: {
          totalSessions,
          totalPageviews,
          avgDuration,
          bounceRate,
          pagesPerSession: totalSessions > 0 ? Math.round((totalPageviews / totalSessions) * 10) / 10 : 0,
        },
        dailyStats: dailyResult.rows,
        trafficSources: trafficResult.rows,
        topPages: topPagesResult.rows,
        devices: devicesResult.rows,
        browsers: browsersResult.rows,
        operatingSystems: osResult.rows,
        topEvents: eventsResult.rows,
        campaigns: campaignsResult.rows,
        recentSessions: recentSessionsResult.rows,
        topReferrers: referrersResult.rows,
      });
    } catch (error) {
      console.error("Web analytics error:", error);
      res.status(500).json({ error: "Failed to fetch web analytics" });
    }
  });

  // Serve media files (videos, images) from attached_assets folder
  // Supports HTTP range requests for video streaming
  // Using /media/ to avoid conflicts with Vite's /assets/ in production builds
  app.get("/media/:filename(*)", (req, res) => {
    try {
      const filename = req.params.filename;
      const assetsRoot = path.resolve(process.cwd(), 'attached_assets');
      const assetsPath = path.resolve(assetsRoot, filename);
      
      console.log('📁 Static asset request:', filename);
      
      // Security: Prevent path traversal attacks
      // Use path.relative to ensure the requested file is within assetsRoot
      const relativePath = path.relative(assetsRoot, assetsPath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        console.log('❌ Path traversal attempt blocked:', assetsPath);
        return res.status(403).send('Forbidden');
      }
      
      // Check if file exists
      if (!fs.existsSync(assetsPath)) {
        console.log('❌ Asset not found:', assetsPath);
        return res.status(404).send('Asset not found');
      }
      
      // Get file stats
      const stat = fs.statSync(assetsPath);
      const fileSize = stat.size;
      
      // Set appropriate headers for videos
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogg': 'video/ogg',
        '.mov': 'video/quicktime',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      // Set common headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      
      // Handle range requests for video streaming
      const range = req.headers.range;
      
      if (range) {
        // Parse range header (e.g., "bytes=0-1023")
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        // Create read stream for the requested range
        const fileStream = fs.createReadStream(assetsPath, { start, end });
        
        // Set partial content headers
        res.status(206); // Partial Content
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunkSize);
        
        fileStream.pipe(res);
        console.log(`✅ Serving asset (range ${start}-${end}):`, filename);
      } else {
        // No range request, send entire file
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Accept-Ranges', 'bytes');
        
        const fileStream = fs.createReadStream(assetsPath);
        fileStream.pipe(res);
        console.log('✅ Serving asset (full):', filename);
      }
    } catch (error) {
      console.error('Error serving static asset:', error);
      res.status(500).send('Error serving asset');
    }
  });

  // Cache GCS file metadata to avoid repeated getMetadata() calls for every video range request
  const videoMetadataCache = new Map<string, { size: number; contentType: string; cachedAt: number }>();
  const VIDEO_METADATA_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Referenced from blueprint: javascript_object_storage - protected file uploading
  // Handle CORS preflight for images and videos
  app.options("/objects/:objectPath(*)", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.sendStatus(200);
  });
  
  // The endpoint for serving objects with ACL checks (public and private)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    
    const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
    const objectStorageService = new ObjectStorageService();
    
    try {
      const isVideo = req.path.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
      console.log(isVideo ? '🎥 Video request:' : '🖼️ Image request:', req.path);
      
      // Get the object file reference
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      
      // Catalogue media (vans, products, kits, upgrades, videos, artwork
      // proofs) is public by path. Anything else — including /uploads/, where
      // the presigned "private" upload flow writes — goes through the object's
      // own ACL policy: objects marked public still serve to everyone, private
      // ones require the owner or a staff member.
      const isPublic = req.path.includes('/van-images/') ||
                      req.path.includes('/product-images/') ||
                      req.path.includes('/upgrade-images/') ||
                      req.path.includes('/videos/') ||
                      req.path.includes('/artwork-proofs/');

      // Perform ACL check BEFORE fetching metadata
      if (!isPublic) {
        const requestUser = await getCurrentUser(req);
        const isStaff = !!requestUser && ["basic", "full"].includes(requestUser.adminRole);
        if (!isStaff) {
          const { ObjectPermission } = await import("./objectAcl");
          const canAccess = await objectStorageService.canAccessObjectEntity({
            objectFile,
            userId: requestUser?.id,
            requestedPermission: ObjectPermission.READ,
          });
          if (!canAccess) {
            console.log('❌ Access denied for:', req.path);
            return res.sendStatus(401);
          }
        }
      }
      
      // For videos, support range requests for streaming
      if (isVideo) {
        const videoMimeTypes: Record<string, string> = {
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.ogg': 'video/ogg',
          '.mov': 'video/quicktime',
        };
        const videoExt = (req.path.match(/\.[^.]+$/) || [''])[0].toLowerCase();
        const extContentType = videoMimeTypes[videoExt] || 'video/mp4';

        try {
          // Use cached metadata to avoid hitting GCS API on every range request
          const cacheKey = req.path;
          const cached = videoMetadataCache.get(cacheKey);
          let fileSize: number;
          let resolvedContentType: string;

          if (cached && (Date.now() - cached.cachedAt) < VIDEO_METADATA_TTL_MS) {
            fileSize = cached.size;
            resolvedContentType = cached.contentType;
          } else {
            const [metadata] = await objectFile.getMetadata();
            fileSize = parseInt(metadata.size as string);
            resolvedContentType = metadata.contentType || extContentType;
            videoMetadataCache.set(cacheKey, { size: fileSize, contentType: resolvedContentType, cachedAt: Date.now() });
          }

          const range = req.headers.range;
          
          if (range) {
            // Parse range header
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            
            // Validate range
            if (start >= fileSize || end >= fileSize || start > end) {
              console.log('❌ Invalid range requested:', range);
              return res.status(416).send('Range Not Satisfiable');
            }
            
            const chunkSize = end - start + 1;
            
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', chunkSize);
            res.setHeader('Content-Type', resolvedContentType);
            res.setHeader('Accept-Ranges', 'bytes');
            
            // Stream the requested range with error handling
            const stream = objectFile.createReadStream({ start, end });
            
            stream.on('error', (streamError: any) => {
              console.error('❌ Stream error:', streamError);
              if (!res.headersSent) {
                res.status(500).send('Error streaming video');
              }
            });
            
            stream.pipe(res);
            console.log(`✅ Streaming video (range ${start}-${end}):`, req.path);
          } else {
            // No range request, send entire file
            res.setHeader('Content-Length', fileSize);
            res.setHeader('Content-Type', resolvedContentType);
            res.setHeader('Accept-Ranges', 'bytes');
            
            const stream = objectFile.createReadStream();
            
            stream.on('error', (streamError: any) => {
              console.error('❌ Stream error:', streamError);
              if (!res.headersSent) {
                res.status(500).send('Error streaming video');
              }
            });
            
            stream.pipe(res);
            console.log('✅ Streaming video (full):', req.path);
          }
        } catch (videoError) {
          console.error('❌ Error preparing video stream:', videoError);
          if (!res.headersSent) {
            return res.status(500).send('Error preparing video');
          }
        }
      } else {
        // For images, use the standard download method
        console.log('✅ Serving file:', req.path);
        objectStorageService.downloadObject(objectFile, res);
      }
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        console.log('❌ File not found:', req.path);
        return res.sendStatus(404);
      }
      if (!res.headersSent) {
        return res.sendStatus(500);
      }
    }
  });

  // The endpoint for getting the upload URL for public product images (kits)
  app.post("/api/objects/upload", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { filename, contentType } = req.body;
      
      // Validate file type - now supports images and videos
      const allowedTypes = [
        'image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'
      ];
      if (!contentType || !allowedTypes.includes(contentType.toLowerCase())) {
        return res.status(400).json({ error: "Only images (PNG, JPEG, SVG, GIF, WEBP) and videos (MP4, WebM, OGG, MOV) are allowed" });
      }
      
      // Validate filename
      if (!filename || filename.trim() === '') {
        return res.status(400).json({ error: "Filename is required" });
      }
      
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, publicURL } = await objectStorageService.getPublicProductUploadURL(filename);
      // Return publicURL as objectPath for backwards compatibility with uploader
      res.json({ uploadURL, objectPath: publicURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Backend proxy endpoint for upgrade image uploads (no CORS issues)
  app.post("/api/upgrades/upload-image", isAuthenticated, isBasicAdmin, async (req, res) => {
    const multer = await import("multer");
    const upload = multer.default({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB
    
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: "File upload failed" });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype.toLowerCase())) {
          return res.status(400).json({ error: "Only images are allowed" });
        }
        
        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();
        
        // Upload file to public storage (returns backend proxy path /objects/upgrade-images/...)
        const publicURL = await objectStorageService.uploadUpgradeImageToPublicStorage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        
        console.log('✅ Upgrade image uploaded successfully:', publicURL);
        res.json({ publicURL });
      } catch (error) {
        console.error("Error uploading upgrade image:", error);
        res.status(500).json({ error: "Failed to upload image" });
      }
    });
  });

  // Admin endpoint for temporary image upload (for create forms)
  app.post("/api/admin/temp-upload", isAuthenticated, isBasicAdmin, async (req, res) => {
    const multer = await import("multer");
    const upload = multer.default({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB
    
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: "File upload failed" });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype.toLowerCase())) {
          return res.status(400).json({ error: "Only images are allowed" });
        }

        // Upload to object storage
        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();
        const url = await objectStorageService.uploadFileToPublicStorage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        res.json({ url });
      } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Upload failed" });
      }
    });
  });

  // Admin endpoint for van image upload - BACKEND PROXY (no CORS issues)
  app.post("/api/admin/vans/:id/upload-image", isAuthenticated, isBasicAdmin, async (req, res) => {
    const multer = await import("multer");
    const upload = multer.default({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB
    
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: "File upload failed" });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype.toLowerCase())) {
          return res.status(400).json({ error: "Only images are allowed" });
        }

        // Verify van exists
        const van = await storage.getVan(req.params.id);
        if (!van) {
          return res.status(404).json({ error: "Van not found" });
        }
        
        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();
        
        // Upload file to public storage
        const publicURL = await objectStorageService.uploadFileToPublicStorage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        
        // Save to van record
        const existingImages = van.images || [];
        const updatedImages = [...existingImages, publicURL];
        
        const updatedVan = await storage.updateVan(req.params.id, {
          images: updatedImages,
          // If no hero image is set, use the first uploaded image
          ...((!van.heroImage && existingImages.length === 0) ? { heroImage: publicURL } : {})
        });

        res.json({ publicURL, van: updatedVan });
      } catch (error) {
        console.error("Error uploading image:", error);
        res.status(500).json({ error: "Failed to upload image" });
      }
    });
  });

  // Admin endpoint for setting ACL policy on uploaded objects
  app.post("/api/admin/objects/set-acl", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { objectPath, acl } = req.body;
      
      if (!objectPath || typeof objectPath !== 'string') {
        return res.status(400).json({ error: "Object path is required" });
      }
      
      if (!acl || !['public', 'private'].includes(acl)) {
        return res.status(400).json({ error: "ACL must be 'public' or 'private'" });
      }
      
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();

      const aclUser = await getCurrentUser(req);
      const aclPolicy = {
        owner: aclUser?.id || "",
        visibility: acl as 'public' | 'private',
      };
      
      // Retry mechanism for GCS eventual consistency
      let lastError;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (attempt > 0) {
            // Wait before retrying (exponential backoff: 100ms, 200ms, 400ms, 800ms)
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
          }
          const normalizedPath = await objectStorageService.trySetObjectEntityAclPolicy(objectPath, aclPolicy);
          return res.json({ objectPath: normalizedPath });
        } catch (error: any) {
          lastError = error;
          // Only retry on "Object not found" errors
          if (!error.message?.includes('not found') && !error.code?.includes('404')) {
            throw error;
          }
        }
      }
      
      // All retries failed
      throw lastError;
    } catch (error) {
      console.error("Error setting ACL:", error);
      res.status(500).json({ error: "Failed to set ACL policy" });
    }
  });

  // Update quote with customer logos after upload
  app.put("/api/quotes/:id/logos", isAuthenticated, async (req, res) => {
    try {
      const { objectPath } = req.body;
      
      if (!objectPath || typeof objectPath !== 'string') {
        return res.status(400).json({ error: "objectPath is required" });
      }

      // Validate objectPath format
      if (!objectPath.startsWith('/objects/uploads/')) {
        return res.status(400).json({ error: "Invalid objectPath format" });
      }

      const logoUser = await getCurrentUser(req);
      const userId = logoUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const quote = await storage.getQuote(req.params.id);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Check ownership
      if (quote.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this quote" });
      }

      // Check max logos limit (5)
      const existingLogos = quote.customerLogoUrls || [];
      if (existingLogos.length >= 5) {
        return res.status(400).json({ error: "Maximum 5 logos allowed per quote" });
      }

      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      // Get the file entity to verify it exists and check metadata
      let objectFile;
      try {
        objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      } catch (error) {
        return res.status(404).json({ error: "File not found. Upload may have failed." });
      }
      
      // Verify file metadata (size and content type)
      const [metadata] = await objectFile.getMetadata();
      const contentType = metadata.contentType || '';
      const fileSize = metadata.size || 0;
      
      // Validate content type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
      if (!allowedTypes.includes(contentType.toLowerCase())) {
        // Delete the invalid file
        await objectFile.delete();
        return res.status(400).json({ error: "Invalid file type. Only images are allowed." });
      }
      
      // Validate file size (10MB max)
      if (Number(fileSize) > 10485760) {
        // Delete the oversized file
        await objectFile.delete();
        return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
      }
      
      // Check for existing ACL policy
      const { getObjectAclPolicy, setObjectAclPolicy } = await import("./objectAcl");
      const existingAcl = await getObjectAclPolicy(objectFile);
      
      if (existingAcl && existingAcl.owner && existingAcl.owner !== userId.toString()) {
        // File already has an ACL with a different owner - this is a security violation
        return res.status(403).json({ error: "Cannot modify file owned by another user" });
      }
      
      // Set ACL policy for the uploaded logo (public visibility so admin can view it)
      if (!existingAcl) {
        await setObjectAclPolicy(objectFile, {
          owner: userId.toString(),
          visibility: "public", // Public so admin can view uploaded logos
        });
      }

      // Add the new logo to the customerLogoUrls array
      const updatedLogos = [...existingLogos, objectPath];
      
      const updated = await storage.updateQuote(req.params.id, {
        customerLogoUrls: updatedLogos,
      });

      res.status(200).json({
        objectPath: objectPath,
        quote: updated,
      });
    } catch (error) {
      console.error("Error adding customer logo:", error);
      res.status(500).json({ error: "Failed to add logo" });
    }
  });

  // Delete a customer logo from a quote
  app.delete("/api/quotes/:id/logos", isAuthenticated, async (req, res) => {
    try {
      const { objectPath } = req.body;
      
      if (!objectPath || typeof objectPath !== 'string') {
        return res.status(400).json({ error: "objectPath is required" });
      }

      const deleteLogoUser = await getCurrentUser(req);
      const userId = deleteLogoUser?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const quote = await storage.getQuote(req.params.id);
      
      if (!quote) {
        return res.status(404).json({ error: "Quote not found" });
      }

      // Check ownership
      if (quote.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this quote" });
      }

      const existingLogos = quote.customerLogoUrls || [];
      const updatedLogos = existingLogos.filter(logo => logo !== objectPath);
      
      // If no logo was removed, return error
      if (updatedLogos.length === existingLogos.length) {
        return res.status(404).json({ error: "Logo not found in quote" });
      }

      const updated = await storage.updateQuote(req.params.id, {
        customerLogoUrls: updatedLogos,
      });

      res.status(200).json({
        quote: updated,
      });
    } catch (error) {
      console.error("Error deleting customer logo:", error);
      res.status(500).json({ error: "Failed to delete logo" });
    }
  });

  // ============================================================
  // SEO: 301 Permanent Redirects for domain migration
  // ============================================================
  const permanentRedirects: Record<string, string> = {
    '/vans-1': '/stock',
    '/vanfinance': '/finance',
    '/info': '/configurator',
    '/all-projects': '/gallery',
    // Normalised location slugs (old -> new)
    '/mobile-tyre-vans/birmingham-dudley': '/mobile-tyre-vans/dudley',
    '/mobile-tyre-vans/bristol-gloucester': '/mobile-tyre-vans/gloucester',
    '/mobile-tyre-vans/newport-wales': '/mobile-tyre-vans/newport',
  };

  Object.entries(permanentRedirects).forEach(([from, to]) => {
    app.get(from, (_req, res) => {
      res.redirect(301, to);
    });
  });

  // Redirect all old /vans/* URLs to /stock
  app.get('/vans/*', (_req, res) => {
    res.redirect(301, '/stock');
  });

  // ============================================================
  // SEO: Server-side meta tag injection for dynamic routes
  // ============================================================
  app.get('/stock/:slug', async (req, res, next) => {
    try {
      const van = await storage.getVanBySlug(req.params.slug);
      if (van && van.published) {
        req.__seoMeta = buildVanMeta(van);
      }
    } catch (e) {
      // Non-fatal: page will use default meta
    }
    next();
  });

  // ============================================================
  // SEO: robots.txt
  // ============================================================
  app.get('/robots.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(`User-agent: *
Allow: /

Disallow: /admin/
Disallow: /admin
Disallow: /api/
Disallow: /login
Disallow: /portal/

Sitemap: ${brandSiteUrl()}/sitemap.xml
`);
  });

  // ============================================================
  // SEO: Dynamic XML Sitemap
  // ============================================================
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const SITE_URL = brandSiteUrl();
      const BUILD_DATE = new Date().toISOString().split('T')[0];

      const vanModelSlugs = [
        'ford-transit',
        'mercedes-sprinter',
        'volkswagen-crafter',
        'nissan-interstar',
        'iveco-daily',
        'citroen-relay',
        'peugeot-boxer',
        'vauxhall-movano',
      ];

      const locationSlugs = [
        'liverpool', 'wirral', 'manchester', 'salford', 'bolton', 'wigan', 'preston',
        'blackpool', 'blackburn', 'burnley', 'stockport', 'warrington', 'chester',
        'st-helens', 'lancaster', 'oldham', 'rochdale',
        'leeds', 'sheffield', 'bradford', 'hull', 'york', 'doncaster', 'huddersfield',
        'rotherham', 'halifax',
        'birmingham', 'coventry', 'wolverhampton', 'dudley', 'walsall',
        'stoke-on-trent', 'shrewsbury', 'telford',
        'nottingham', 'derby', 'leicester', 'northampton', 'peterborough',
        'norwich', 'ipswich', 'cambridge', 'luton', 'milton-keynes',
        'london', 'east-london', 'south-london', 'north-london', 'west-london',
        'reading', 'oxford', 'brighton', 'southampton', 'portsmouth', 'bournemouth',
        'bristol', 'exeter', 'plymouth', 'taunton', 'gloucester', 'swindon',
        'newcastle', 'sunderland', 'middlesbrough', 'gateshead', 'durham',
        'glasgow', 'edinburgh', 'aberdeen', 'dundee', 'stirling', 'inverness',
        'cardiff', 'swansea', 'newport', 'wrexham',
      ];

      const staticPages = [
        { url: '/', changefreq: 'weekly', priority: '1.0' },
        { url: '/stock', changefreq: 'daily', priority: '0.9' },
        { url: '/configurator', changefreq: 'monthly', priority: '0.9' },
        { url: '/finance', changefreq: 'monthly', priority: '0.8' },
        { url: '/training', changefreq: 'monthly', priority: '0.8' },
        { url: '/business-opportunity', changefreq: 'monthly', priority: '0.8' },
        { url: '/van-conversions', changefreq: 'monthly', priority: '0.8' },
        { url: '/mobile-tyre-vans', changefreq: 'monthly', priority: '0.8' },
        ...vanModelSlugs.map(slug => ({ url: `/van-conversions/${slug}`, changefreq: 'monthly', priority: '0.7' })),
        ...locationSlugs.map(slug => ({ url: `/mobile-tyre-vans/${slug}`, changefreq: 'monthly', priority: '0.6' })),
        { url: '/gallery', changefreq: 'weekly', priority: '0.7' },
        { url: '/blog', changefreq: 'weekly', priority: '0.7' },
        { url: '/about', changefreq: 'monthly', priority: '0.7' },
        { url: '/contact', changefreq: 'monthly', priority: '0.6' },
        { url: '/how-it-works', changefreq: 'monthly', priority: '0.6' },
      ];

      const vans = await storage.getVans();
      const publishedVans = vans.filter(v => v.published && v.slug);

      let publishedBlogPosts: Array<{ slug: string; updatedAt: Date | null }> = [];
      try {
        publishedBlogPosts = await storage.getBlogPosts();
      } catch { /* table may not exist yet */ }

      const staticEntries = staticPages.map(page => `
  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${BUILD_DATE}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('');

      const vanEntries = publishedVans.map(van => {
        const lastmod = van.updatedAt
          ? new Date(van.updatedAt).toISOString().split('T')[0]
          : BUILD_DATE;
        const heroImg = van.heroImage || (van.images && van.images[0]);
        const absoluteImgUrl = heroImg
          ? (heroImg.startsWith('http') ? heroImg : `${SITE_URL}${heroImg.startsWith('/') ? '' : '/'}${heroImg}`)
          : null;
        const imageTag = absoluteImgUrl
          ? `
    <image:image>
      <image:loc>${absoluteImgUrl}</image:loc>
      <image:title>${van.year} ${van.make} ${van.model} - Mobile Tyre Van</image:title>
    </image:image>`
          : '';
        return `
  <url>
    <loc>${SITE_URL}/stock/${van.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageTag}
  </url>`;
      }).join('');

      const blogEntries = publishedBlogPosts.map(post => {
        const lastmod = post.updatedAt
          ? new Date(post.updatedAt).toISOString().split('T')[0]
          : BUILD_DATE;
        return `
  <url>
    <loc>${SITE_URL}/blog/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
      }).join('');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticEntries}
${vanEntries}
${blogEntries}
</urlset>`;

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(xml);
    } catch (error) {
      console.error('Sitemap error:', error);
      res.status(500).send('Failed to generate sitemap');
    }
  });

  // One-time catalog sync endpoint: replaces production catalog data with dev data
  app.post("/api/admin/sync-catalog", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const syncDataPath = path.join(process.cwd(), "server", "catalog-sync-data.json");
      if (!fs.existsSync(syncDataPath)) {
        return res.status(404).json({ error: "Sync data file not found" });
      }
      const syncData = JSON.parse(fs.readFileSync(syncDataPath, "utf-8"));
      const { vans, kits, upgrades, training_options } = syncData;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Null out FK references in quotes so we can safely replace catalog
        await client.query("UPDATE quotes SET van_id = NULL");
        await client.query("UPDATE quotes SET kit_id = NULL");
        await client.query("UPDATE quotes SET selected_upgrade_ids = '[]'::json");
        await client.query("UPDATE quotes SET selected_upgrades = '[]'::json");
        await client.query("UPDATE quotes SET training_option_ids = '[]'::json");

        // Clear catalog tables (preserving quotes, leads, users)
        await client.query("DELETE FROM training_options");
        await client.query("DELETE FROM upgrades");
        await client.query("DELETE FROM kits");
        await client.query("DELETE FROM vans");

        // Insert vans
        for (const v of vans) {
          await client.query(
            `INSERT INTO vans (id, slug, title, make, model, year, mileage, price, vat_included, specs, images, hero_image, created_at, updated_at, published, description, euro_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::json,$11::json,$12,$13,$14,$15,$16,$17)`,
            [v.id, v.slug, v.title, v.make, v.model, v.year, v.mileage, v.price, v.vat_included,
             JSON.stringify(v.specs), JSON.stringify(v.images), v.hero_image,
             v.created_at, v.updated_at, v.published, v.description, v.euro_status]
          );
        }

        // Insert kits
        for (const k of kits) {
          await client.query(
            `INSERT INTO kits (id, name, description, includes, power_kw, price, created_at, updated_at, published, sort_order, images, euro_six_compatible)
             VALUES ($1,$2,$3,$4::json,$5,$6,$7,$8,$9,$10,$11::json,$12)`,
            [k.id, k.name, k.description, JSON.stringify(k.includes), k.power_kw, k.price,
             k.created_at, k.updated_at, k.published, k.sort_order, JSON.stringify(k.images), k.euro_six_compatible]
          );
        }

        // Insert upgrades
        for (const u of upgrades) {
          await client.query(
            `INSERT INTO upgrades (id, name, category, description, price, created_at, updated_at, published, images, parent_id, variant_name, allow_quantity, sort_order, popular, video_url, detailed_info, show_video, exclusive_group)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::json,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [u.id, u.name, u.category, u.description, u.price, u.created_at, u.updated_at,
             u.published, JSON.stringify(u.images), u.parent_id, u.variant_name,
             u.allow_quantity, u.sort_order, u.popular, u.video_url, u.detailed_info, u.show_video,
             u.exclusive_group ?? null]
          );
        }

        // Insert training options
        for (const t of training_options) {
          await client.query(
            `INSERT INTO training_options (id, name, description, includes, price, published, created_at, updated_at, type, duration_days)
             VALUES ($1,$2,$3,$4::json,$5,$6,$7,$8,$9,$10)`,
            [t.id, t.name, t.description, JSON.stringify(t.includes), t.price, t.published,
             t.created_at, t.updated_at, t.type, t.duration_days]
          );
        }

        await client.query("COMMIT");
        res.json({
          success: true,
          message: `Catalog sync complete`,
          counts: { vans: vans.length, kits: kits.length, upgrades: upgrades.length, training_options: training_options.length }
        });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Sync catalog error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Public endpoint: get site settings (video URLs etc.)
  app.get("/api/site-settings", async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch site settings" });
    }
  });

  // Admin endpoint: send a branded email preview for design sign-off
  app.post("/api/admin/email-preview", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { to, emailType } = req.body as { to?: string; emailType?: string };
      if (!to || typeof to !== 'string' || !to.includes('@')) {
        return res.status(400).json({ error: 'A valid email address is required.' });
      }
      const { sendEmailTypePreview, EMAIL_PREVIEW_TYPES } = await import('./email');
      type PreviewType = typeof EMAIL_PREVIEW_TYPES[number]['type'];
      const validTypes: readonly string[] = EMAIL_PREVIEW_TYPES.map(e => e.type);
      if (!emailType || !validTypes.includes(emailType)) {
        return res.status(400).json({ error: `Invalid email type. Must be one of: ${validTypes.join(', ')}` });
      }
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      await sendEmailTypePreview(to, emailType as PreviewType, baseUrl);
      res.json({ success: true, to, emailType });
    } catch (error: any) {
      console.error('Email preview error:', error);
      res.status(500).json({ error: error?.message ?? 'Failed to send preview email.' });
    }
  });

  // ── Admin notification recipients (per-channel) ───────────────────────────
  // Each recipient subscribes to one or more notification channels — so e.g.
  // Beth can be subscribed only to depot_invoice ("Send to Admin"), while
  // others get the full firehose. See server/email.ts NOTIFY_CHANNELS for the
  // canonical channel list. Stored as JSON array in site_settings under
  // `admin_notify_recipients`. Legacy `admin_notify_emails` is still honoured
  // (each address read as subscribed to every non-depot channel).
  app.get("/api/admin/notify-recipients", isAuthenticated, isFullAdmin, async (_req, res) => {
    try {
      const { getNotifyRecipients, getInternalNotifyEmails, NOTIFY_CHANNELS, ADMIN_NOTIFY_RECIPIENTS_KEY, ADMIN_NOTIFY_EMAILS_KEY } = await import('./email.js');
      const recipients = await getNotifyRecipients();
      const settings = await storage.getSiteSettings();
      const isCustom = Boolean(settings[ADMIN_NOTIFY_RECIPIENTS_KEY] || settings[ADMIN_NOTIFY_EMAILS_KEY]);
      // Per-channel effective recipient lists — what is *actually* receiving
      // each notification right now. Lets the UI render a clear at-a-glance
      // view (and prefill the editor with the current state when nothing has
      // been customised yet, so the list is never falsely empty).
      const effectiveByChannel: Record<string, string[]> = {};
      for (const c of NOTIFY_CHANNELS) {
        effectiveByChannel[c.id] = await getInternalNotifyEmails(c.id);
      }
      res.json({ recipients, channels: NOTIFY_CHANNELS, isCustom, effectiveByChannel });
    } catch (err) {
      res.status(500).json({ error: "Failed to load notification recipients" });
    }
  });

  app.put("/api/admin/notify-recipients", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { NOTIFY_CHANNELS, ADMIN_NOTIFY_RECIPIENTS_KEY, ADMIN_NOTIFY_EMAILS_KEY } = await import('./email.js');
      const validChannels = NOTIFY_CHANNELS.map((c) => c.id) as readonly string[];
      const body = z.object({
        recipients: z.array(z.object({
          email: z.string().trim().email("Each recipient must have a valid email"),
          channels: z.array(z.string()),
        })).max(50),
      }).parse(req.body);
      // Normalise: lowercase, dedupe, filter invalid channel ids, dedupe by
      // email (later entries win — merge would surprise the user vs the UI).
      const seen = new Map<string, string[]>();
      for (const r of body.recipients) {
        const email = r.email.trim().toLowerCase();
        if (!email) continue;
        const channels = Array.from(new Set(r.channels.filter((c) => validChannels.includes(c))));
        seen.set(email, channels);
      }
      const cleaned = Array.from(seen.entries()).map(([email, channels]) => ({ email, channels }));
      // Empty list clears the override (defaults take over again).
      await storage.setSiteSetting(ADMIN_NOTIFY_RECIPIENTS_KEY, cleaned.length ? JSON.stringify(cleaned) : '');
      // Also wipe the legacy key so it doesn't shadow an intentional empty list.
      if (cleaned.length === 0) await storage.setSiteSetting(ADMIN_NOTIFY_EMAILS_KEY, '');
      res.json({ success: true, recipients: cleaned, cleared: cleaned.length === 0 });
    } catch (err: any) {
      if (err?.errors) {
        return res.status(400).json({ error: err.errors[0]?.message ?? "Invalid input" });
      }
      res.status(500).json({ error: err?.message ?? "Failed to save recipients" });
    }
  });

  // ── Kiosk PINs (admin-managed) ────────────────────────────────────────────
  // The lads use these 4-digit PINs to undo a stage tick on the kiosk. PINs
  // live in site_settings (key `kiosk_pin_<initials>`) so full admins can
  // rotate them without a redeploy. Env var KIOSK_PIN_<INITIALS> still acts
  // as a fallback for any initials not yet set in the DB.
  const KIOSK_PEOPLE: Array<{ initials: string; name: string }> = [
    { initials: "GB", name: "Gaz" },
    { initials: "KJ", name: "Kev" },
    { initials: "HM", name: "Haz" },
    { initials: "RM", name: "Zino" },
    { initials: "NK", name: "Nick" },
    { initials: "RC", name: "Ryan" },
    { initials: "KW", name: "Kenny" },
    { initials: "PF", name: "Paul" },
    { initials: "EC", name: "Eddie" },
  ];
  const KIOSK_INITIALS = new Set(KIOSK_PEOPLE.map((p) => p.initials));

  app.get("/api/admin/kiosk-pins", isAuthenticated, isFullAdmin, async (_req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      const list = KIOSK_PEOPLE.map(({ initials, name }) => {
        const dbVal = settings[`kiosk_pin_${initials.toLowerCase()}`];
        const envVal = process.env[`KIOSK_PIN_${initials}`];
        const source: "db" | "env" | null = dbVal ? "db" : envVal ? "env" : null;
        return { initials, name, hasPin: Boolean(dbVal || envVal), source };
      });
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: "Failed to load kiosk PINs" });
    }
  });

  app.put("/api/admin/kiosk-pins/:initials", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const initials = String(req.params.initials || "").toUpperCase();
      if (!KIOSK_INITIALS.has(initials)) {
        return res.status(400).json({ error: "Unknown initials" });
      }
      const body = z.object({ pin: z.string() }).parse(req.body);
      const pin = body.pin.trim();
      if (pin.length > 0 && !/^\d{4}$/.test(pin)) {
        return res.status(400).json({ error: "PIN must be exactly 4 digits, or empty to clear." });
      }
      // Empty pin clears the override (falls back to env var if one exists).
      await storage.setSiteSetting(`kiosk_pin_${initials.toLowerCase()}`, pin);
      res.json({ success: true, initials, cleared: pin.length === 0 });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "Failed to save PIN" });
    }
  });

  // Admin endpoint: update a site setting
  app.put("/api/admin/site-settings/:key", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const { value } = req.body;
      if (typeof value !== "string") {
        return res.status(400).json({ error: "value must be a string" });
      }
      await storage.setSiteSetting(key, value);
      res.json({ success: true, key, value });
    } catch (error) {
      res.status(500).json({ error: "Failed to update site setting" });
    }
  });

  // Admin endpoint: upload a video to object storage
  app.post("/api/admin/upload-video", isAuthenticated, isAdmin, async (req, res) => {
    const multer = await import("multer");
    const upload = multer.default({ 
      storage: multer.memoryStorage(),
      limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
    });

    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: "File upload failed" });
      }
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }
        const allowedTypes = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
        if (!allowedTypes.includes(req.file.mimetype.toLowerCase())) {
          return res.status(400).json({ error: "Only video files are allowed" });
        }
        const { ObjectStorageService } = await import("./objectStorage");
        const objectStorageService = new ObjectStorageService();
        const url = await objectStorageService.uploadVideoToPublicStorage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        res.json({ url });
      } catch (error) {
        console.error("Video upload error:", error);
        res.status(500).json({ error: "Video upload failed" });
      }
    });
  });


  // ─── AI Chat Configurator ────────────────────────────────────────────────────

  // Public LLM endpoint: rate-limited per IP and payload-capped so it can't
  // be scripted into an API-cost sink.
  const aiChatLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many messages — please wait a few minutes and try again." },
  });

  app.post("/api/ai-chat/message", aiChatLimiter, async (req, res) => {
    try {
      const { messages, sessionId, contactName, contactPhone } = req.body as {
        messages: Array<{ role: string; content: string }>;
        sessionId: string;
        contactName?: string | null;
        contactPhone?: string | null;
      };

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "messages array required" });
      }
      if (messages.length > 60) {
        return res.status(400).json({ error: "Conversation too long — please start a new chat." });
      }
      const totalChars = messages.reduce((sum, m) => sum + (typeof m?.content === "string" ? m.content.length : 0), 0);
      if (totalChars > 40_000 || messages.some((m) => typeof m?.content === "string" && m.content.length > 4_000)) {
        return res.status(400).json({ error: "Message too large." });
      }

      // Fetch live data to inject into system prompt (so AI uses real IDs)
      const [kits, upgrades, financePlans, packagesResult, popularityIntel, siteSettings] = await Promise.all([
        storage.getKits(),
        storage.getUpgrades(),
        storage.getFinancePlans(),
        pool.query("SELECT * FROM ai_packages WHERE active = TRUE ORDER BY tier ASC"),
        computePopularityIntelligence().catch(err => {
          console.error("[ai-chat] Failed to compute popularity intelligence:", err);
          return null;
        }),
        storage.getSiteSettings().catch(() => ({} as Record<string, string>)),
      ]);
      const maxBusinessContext = (siteSettings as Record<string, string>)["max_business_context"]?.trim() ?? "";
      const packages: Array<{ id: string; name: string; tier: number; description: string | null; recommended_for: string | null; upgrade_ids: string[] }> = packagesResult.rows;

      const kitsInfo = kits.map(k => {
        const isEuro6 = k.id.includes("euro6") && !k.id.includes("non-euro6");
        const isFullyAuto = k.id.includes("t2000");
        return `- "${k.name}" (id: "${k.id}", euro6: ${isEuro6 ? "YES — for vans registered 2015 or later" : "NO — for vans registered before 2015"}, machine: ${isFullyAuto ? "FULLY-AUTO T2000 with assist arms (better for run-flats and low-profiles)" : "SEMI-AUTO T1000 standard tyre changer"})`;
      }).join("\n");

      const upgradesInfo = upgrades.map(u =>
        `- "${u.name}" (id: "${u.id}", category: "${u.category}", popular: ${u.popular ? "YES" : "no"}, forCommercial: ${u.forCommercial ?? false})`
      ).join("\n");

      const financePlansInfo = financePlans.map(p =>
        `- "${p.name}" (id: "${p.id}", type: ${p.type}, term: ${p.termMonths} months)`
      ).join("\n");

      const packagesInfo = packages.map(p => {
        const upgradeNames = p.upgrade_ids.map((uid: string) => upgrades.find(u => u.id === uid)?.name || uid).join(", ");
        return `- ${p.name.toUpperCase()} (id: "${p.id}", tier: ${p.tier})\n  Recommended for: ${p.recommended_for || "N/A"}\n  Upgrades: ${upgradeNames || "none configured yet"}`;
      }).join("\n");

      const popularityBlock = popularityIntel
        ? formatPopularityBlock(popularityIntel)
        : "POPULARITY INTELLIGENCE: Temporarily unavailable — use general best-practice recommendations.";
      console.debug(`[ai-chat] Popularity intel: ${popularityIntel?.totalMeaningfulQuotes ?? 0} quotes, 48V rate: ${popularityIntel?.rate48v ?? 0}%, top upgrades: ${popularityIntel?.allUpgradesOverall?.slice(0, 3).map(u => u.name).join(", ") ?? "none"}`);

      const systemPrompt = `You are ${BRAND.assistantName}, the AI van builder for ${BRAND.name}, ${BRAND.vertical.conversionTerm} specialists in the UK. ${BRAND.vertical.aiContext} Phone: ${BRAND.phone}. Website: ${BRAND.domain}

YOUR NAME: Max. Always refer to yourself as Max. Never describe yourself as an AI, bot, or assistant — you're Max, the van builder.

PERSONALITY:
- Friendly, straight-talking, commercial. Feels like a knowledgeable salesperson not a chatbot.
- Short messages — no essays, no walls of text. Plain English.
- Natural reactions: "Good choice", "That's our most popular setup", "Solid option at your job volume", "Most customers in your position go for that"
- If customer goes off topic, gently steer back
- Never robotic, never pushy, never sycophantic

YOUR GOAL:
Ask up to 9 questions conversationally (one at a time, never as a list or form) to build a complete van configuration. Map answers to real configurator options using the IDs provided below. You MUST ask about the tyre machine type (semi-auto vs fully-auto) and van year (if own van) in order to recommend the correct kit.

AVAILABLE KITS (use exact IDs):
${kitsInfo || "No kits configured yet"}

AVAILABLE UPGRADES (use exact IDs, note popular=YES means commonly chosen):
${upgradesInfo || "No upgrades configured yet"}

AVAILABLE FINANCE PLANS (use exact IDs):
${financePlansInfo || "No finance plans configured yet"}

AVAILABLE PACKAGES — choose exactly one per build (set packageId and upgradeIds together):
${packagesInfo || "No packages configured yet. Use upgradeIds freely."}

PACKAGE SELECTION RULES:
Bronze = budget-conscious, just starting out, or lower volume (under 15 jobs/day)
Silver = growing operation, 10–20 jobs/day, best balance of kit and cost — our most popular
Gold = high volume (20+ jobs/day), maximum capability, professional setup
Base your recommendation primarily on Q2 (daily workload) and Q1 (purpose/context).
→ Once package is selected, set BOTH packageId and upgradeIds to that package's upgrade list exactly.
→ If the customer wants a different tier, update BOTH packageId and upgradeIds together.
→ NEVER mix upgrade IDs from different packages — a package is a complete spec.

KIT SELECTION — how to determine the correct kitId:
The kit is determined by TWO factors: Euro 6 status and machine type.
Once you have BOTH answers, immediately set kitId in your config response.

  Euro 6 = NO (pre-2015 van)  + machine = semi-auto  → "pack-1-non-euro6-t1000"
  Euro 6 = YES (2015+ van)    + machine = semi-auto  → "pack-2-euro6-t1000"
  Euro 6 = NO (pre-2015 van)  + machine = fully-auto → "pack-3-non-euro6-t2000"
  Euro 6 = YES (2015+ van)    + machine = fully-auto → "pack-4-euro6-t2000"

If supplying the van (ownVan: false): always default to Euro 6 (we supply 2015+ vans).
If Euro 6 status genuinely cannot be determined: default to Euro 6 (safer assumption).
Set isEuro6 and machineType in config as soon as you know them.

PRE-CAPTURED CONTACT INFO (from the form the customer filled in before chatting):
${contactName ? `✅ Name already captured: "${contactName}". You MUST NOT ask for their name — you already have it. Set config.contactName = "${contactName}" immediately. Greet them by name from the very first message.` : "❌ Name not yet captured — ask for it in your opening message (Q0)."}
${contactPhone ? `✅ Phone already captured: "${contactPhone}". You MUST NOT ask for their phone number — you already have it. Set config.contactPhone = "${contactPhone}" immediately. Skip the phone collection step entirely.` : "❌ Phone not yet captured — ask for it at the summary stage as normal."}

CONVERSATION FLOW — ask in this order, one at a time:

SPECIAL TRIGGER: If the user's message is exactly "__GREET__", this is a system trigger meaning the chat has just been opened and the customer is waiting. Respond with your opening message immediately — do not acknowledge or repeat the trigger word.
${contactName ? `Since you already know the customer's name is "${contactName}", skip Q0 entirely. Open with a warm personalised greeting using their name, introduce yourself as Max, briefly explain what you'll do (a few questions → priced build → review and quote), then go straight to Q1.` : ""}

Q0 — NAME (skip this entirely if name is already captured above):
Ask for the customer's name in a warm, natural way as part of your greeting. Always do this first — before asking about their van or purpose. Something like:

"Hi there — I'm ${BRAND.assistantName}, the van builder for ${BRAND.name}. I'm going to ask you a few quick questions and put together a full, priced conversion spec for you — takes about 5 minutes. What's your name?"

Adapt the wording — don't be robotic — but always:
1. Introduce yourself as Max
2. Briefly explain what you'll do (a few questions → priced build → review and quote)
3. Ask their name at the end of the same message

→ Once they give a name, store it in config.contactName immediately
→ Use their name naturally throughout the conversation — don't overdo it, just occasionally: "Good call, [name]", "Most operators in your position, [name], go for..."

Q1 — PURPOSE (ask AFTER they've given their name):
Use their name warmly and then ask Q1. Something like:
"Nice to meet you, [name]! So — are you just starting out in mobile tyres, expanding an existing fleet, or replacing one of your current vans?"

→ Starting out = lean towards entry/mid kit
→ Expanding fleet = mid/premium kit
→ Replacing = ask what they currently run

Q2 — DAILY WORKLOAD:
"Got it — and roughly how many tyre jobs are you looking to do per day?"
→ Under 10 = standard kit, lean towards MWB → set dailyJobVolume: "standard"
→ 10-20 = mid kit → set dailyJobVolume: "standard"
→ 20+ = full kit, lean towards LWB → set dailyJobVolume: "high"
Set dailyJobVolume in config as soon as you have a number from the customer.

Q2b — VEHICLE TYPE (ask immediately after workload, before van supply):
"And what type of vehicles will you mainly be working on — cars and light vans, commercials like HGVs and LCVs, or a mix of both?"
→ Cars / light vans → set serviceType: "car"
→ Commercials / HGV / LCV → set serviceType: "commercial"
→ Mix of both / all types → set serviceType: "hybrid"
This affects kit and upgrade recommendations — higher commercial volume leans towards fully-auto and LWB.

Q3 — VAN SUPPLY:
"Do you already have a van you want us to convert, or do you need us to supply one as part of the package?"
→ Own van = set ownVan: true, go to Q3a
→ Need one supplied = set ownVan: false, isEuro6: true (our stock is 2015+), then respond warmly:
  "Great — we have a really good selection in stock at the moment — Sprinters, full-size Transits and Crafters. The team will go through the specific models and pricing with you on the call. For now, let's make sure the conversion is specced out perfectly. [then go to Q4 — van size]"
  Do NOT ask for a budget, do NOT list stock, do NOT quote van prices. That conversation belongs with the sales team.

Q3a — VAN YEAR (only if they have their own van — do NOT ask if we're supplying the van):
Ask conversationally about the van's year — do NOT ask "is it Euro 6?" as most people don't know.
Ask something like: "What year is the van?"
→ 2015 or newer → set isEuro6: true
→ Pre-2015 → set isEuro6: false
→ "Not sure" / vague → follow up: "Is it a fairly recent one — say in the last 10 years?" 
   - Yes → isEuro6: true
   - No / old → isEuro6: false
   - Still unsure → default isEuro6: true (safer assumption, don't labour the point)
Do NOT mention "Euro 6" to the customer at any point — it's a technical term they won't know.

Q4 — VAN SIZE (only if supplying the van, skip if own van):
"Just so you know — we work with full-size panel vans (Sprinter, full-size Transit, Crafter and similar). We don't do the smaller vans like the Transit Custom. On those vans we offer two body lengths: MWB (Medium Wheelbase) which is great for tight spaces and residential streets, or LWB (Long Wheelbase) for maximum capacity and high-volume work. Which suits you better — or not sure yet?"
→ If 20+ jobs/day from Q2, lead with "Based on the volume you're doing, most customers go LWB..."
→ If under 10 jobs/day, lead with "At that volume the MWB is probably your sweet spot..."

Q5 — TYRE MACHINE TYPE (ask everyone — this determines which kit they get):
Ask something like: "One thing worth knowing about — do you want a standard tyre changer, or would you prefer a fully automatic one with assist arms? The fully auto version makes run-flats and low-profile tyres a lot easier to handle. A lot of our customers wish they'd gone fully auto from the start — but it's a bit more kit."
→ Standard / semi-auto / "just the standard" → set machineType: "semi-auto"
→ Fully auto / assist arms / "the better one" → set machineType: "fully-auto"
→ "Not sure" → briefly explain the difference and recommend based on their workload:
   - High volume or commercial → lean towards fully-auto
   - Lower volume → semi-auto is fine
Once you have machineType AND isEuro6, set kitId immediately using the KIT SELECTION rules above.

Q6 — PACKAGE RECOMMENDATION (after machine type is confirmed):
Based on Q1 (purpose), Q2 (daily workload), and Q2b (vehicle type), make a clear recommendation — do NOT present all three at once.
→ Commercial / hybrid vehicle type signals heavier use — lean Silver or Gold
→ Cars only at low volume — Bronze may be appropriate

WHEN RECOMMENDING A PACKAGE:
List EVERY upgrade included in that package — not just 2–3 highlights. The customer needs to see exactly what they're getting. Format as a clean, short list. Then ask if they want to go with it or explore the tier above.
Example:
"Based on 8 jobs a day and you're just getting started, I'd go with our Bronze package. Here's everything that comes with it:
• Mounted PTO Air System Upgrade
• Standard Light Package
• Standard Reversing Camera
• Accessories Pack
That's your full conversion sorted. Want to go with that, or curious what the Silver adds on top?"

WHEN CUSTOMER ASKS ABOUT A HIGHER TIER (upsell):
Do NOT repeat everything in the recommended package. Only show what's DIFFERENT — what they gain by moving up. Then make a compelling case for why it's worth it at their job volume.
Example (moving Bronze → Silver):
"Here's what Silver adds over Bronze:
• Compressor Upgrade To 12hp 270 Litre Electric Start
• Fini 9 Meter Air Reel With Built In Compressor
• CCTV / NVR System
• Dash Camera
That's the kit that makes the real difference once you're out on the road every day. Most operators at [their volume] end up wishing they'd gone Silver from the start. Want to step up, or stick with Bronze?"

→ Immediately set packageId and upgradeIds to the recommended package's values on recommendation
→ If customer wants a different tier, update BOTH packageId and upgradeIds to that tier's values
→ Keep it conversational — never present a bullet-list of all three packages unless they ask to compare

Q6b — BRANDING / GRAPHICS (ask after package is confirmed — always ask this):
Once the package tier is agreed, ask about branding. Give it its own dedicated message — never bundle it with the package question.

Ask something like:
"One more thing before we move on — do you want the van branded up? We work with a specialist graphics company to do this in-house as part of the build. There are three options:

• Graphic Pack — your logo and contact details on the van sides. Clean, professional look. Great entry-level branding.
• Half Wrap — lower half of the van in your colour with graphics. Makes a proper statement on the road.
• Full Wrap — whole van, top to bottom, full colour and graphics. Maximum impact — it becomes a moving billboard for your business.

Or if you're sorting that separately or not ready yet, just say 'not now' and we'll leave it off the spec.

Which suits you?"

BRANDING — PACKAGE PAIRING HINTS (use these naturally, don't read them out):
→ Gold package → lean towards Full Wrap: "If you're going all-in with the Gold spec, the full wrap really completes it — the van looks the part from the moment it leaves the workshop."
→ Silver package → Half Wrap or Full Wrap: "Most Silver customers go for at least a half wrap — it's the setup that looks properly commercial."
→ Bronze package → Graphic Pack: "For the Bronze, the graphic pack is the sweet spot — your branding on both sides, looks sharp without adding a huge amount to the cost."

BRANDING — ID SELECTION RULES (critical — use exact IDs only):
The branding options are variant groups. You MUST add the variant that matches the van size already captured in config.vanSize.

Full Wrap:
  → LWB van → add upgrade ID: "32e08778-1c03-451e-8345-a82052936e1a"
  → MWB van → add upgrade ID: "3475cbdb-0629-4104-9b56-113508a948e1"

Half Wrap:
  → LWB van → add upgrade ID: "be1a262d-3374-4af8-9144-f93f58c596cc"
  → MWB van → add upgrade ID: "54032c70-1f9f-48ca-936f-aa3865b870b7"

Graphic Pack:
  → LWB van → add upgrade ID: "3c34e119-8024-4431-8c0c-95c7c93758d5"
  → MWB van → add upgrade ID: "170f94dc-6ac9-480a-9ef9-b11167526982"

→ If van size is not yet known (own van, no size captured): ask "Is it an LWB or MWB van?" before selecting — or if they don't know, default to MWB and tell them "I'll add it as MWB for now — easy to update on the review screen if needed."
→ Branding options are MUTUALLY EXCLUSIVE — never add two branding IDs. If the customer changes their mind, remove the previous one first.
→ If they say "not now" / "skip" / "sort separately": do not add any branding upgrade. That's fine — note it mentally but move on.
→ The parent group IDs (full-revalco-wrap, half-wrap, graphic-pack) must NEVER be added to upgradeIds — always use the variant IDs above.

Q7 — 48V LITHIUM SYSTEM (dedicated pitch moment — never treat as throwaway):
Give this a dedicated moment. Say something like:
"Before we lock this in — can I tell you about something most of our customers say is the best thing about their van once they're out on the road?

We fit a 48V lithium silent compressor system using an ABAC professional compressor. Here's what that means for your day: it's completely silent — no generator noise while you work. It runs off the lithium battery, not the engine, so zero fuel cost. You can work with doors shut in winter — no fumes, no cold. The ABAC compressor runs at 10 bar at 100% duty cycle, flat out all day. The power system — battery, inverter and all electrical components — comes with a 5-year warranty. The ABAC compressor itself has a 12-month warranty with servicing only every 3,000 run hours.

Want to include this on your build?"

CRITICAL WARRANTY RULES — NEVER MIX THESE UP:
✓ 5-year warranty = power system ONLY (battery, inverter, electrical components)
✓ 12-month warranty = ABAC compressor ONLY
✓ 3,000 run hours = compressor SERVICE INTERVAL only
✗ NEVER say 5-year warranty on the compressor
✗ NEVER say everything has 5 years
✗ NEVER combine them into one statement

KIT SUPPLY RULE — ABSOLUTE:
✗ MTV does NOT fit customer-supplied equipment or third-party machines under any circumstances
✗ NEVER agree to fit a customer's own tyre changer, compressor, balancer, or any other equipment
✓ If asked, decline warmly and explain: "We only fit equipment we supply ourselves — it's a warranty and quality-control thing. If something goes wrong with kit we haven't sourced and tested, we can't stand behind the build."
✓ After declining, immediately steer back to the MTV packages: explain what's included and invite them to continue building their van with MTV kit

48V UPGRADE IDs — CRITICAL:
When the customer agrees to 48V (or you add it by default), you MUST:
1. Set includes48v: true
2. Look in the AVAILABLE UPGRADES list above for upgrades with "silent" or "48V" in the name — these are the 48V compressor upgrades
3. Add the correct upgrade ID to upgradeIds. If there are multiple compressor variants (e.g. different sizes/models), ask the customer which they prefer OR add the first one listed and note they can change it on the review screen.
4. The 48V system supersedes the standard petrol compressor from the kit — do NOT also add petrol compressor upgrades.

48V OBJECTION HANDLING:
- "Is it expensive?" → "It adds to the upfront cost but fuel savings mean most customers recoup it within the first year. We can spread the cost through finance so it doesn't all hit at once."
- "Will it keep up?" → "100% duty cycle means it literally cannot be overwhelmed — it's rated to run continuously all day at 10 bar. Whatever you throw at it, it keeps going."
- "I've always used diesel/petrol" → "Most of our customers said exactly that. Within a week they're telling us they'd never go back — no fumes, no noise, no fuel cost."
- "I'll think about it" → Set includes48v: true AND add the 48V upgrade ID to upgradeIds, say "No problem — I'll add it to your config as an optional extra so you can see it priced up. Easy to remove if you decide against it."
- Hard NO → include one final soft mention on summary card only, then drop it completely. Track as "hard_no".

Q8 — FINANCE:
"How are you looking to fund this — buy outright, business lease, or spread the cost with finance?"
→ Map to financePreference: "outright", "lease", or "finance"
→ If "finance" or "lease", pick appropriate financePlanId from the list

Q9 — CALLBACK NUMBER (ask naturally after finance — this is your close):
After finance preference is confirmed, ask for a callback number in a completely natural, low-pressure way. Make it feel like a logical next step, not a data grab. Something like:

"Great — I'll get that all priced up for you now. Do you want one of our team to give you a ring to go over the numbers and get things moving? If so, what's the best number to reach you on?"

Or vary it naturally:
"Nice one. We'll have your full build priced up and ready. Want the team to give you a call to talk it through — what number should they use?"

IMPORTANT rules for Q9:
→ NEVER say "completely optional" or frame it as a form — that kills the conversation
→ Make it sound like a natural next step: they've built their van, now let's get the team to call them
→ If they give a number, store it in config.contactPhone immediately and respond warmly: "Perfect — I'll make sure the team have your number alongside the build. Let me get your full spec up now."
→ If they say "no thanks" / "not now" / "I'll call you": respond naturally: "No problem at all — your full spec will be saved and you can request a quote directly from the summary. Let's get it up on screen for you." Then proceed to summary stage.
→ If they give a number AND a name wasn't collected earlier (unlikely but handle it): ask their name too before proceeding.

${popularityBlock}

POPULAR UPGRADES — HOW TO USE REAL DATA:
The POPULARITY INTELLIGENCE block above is derived from actual customer quote submissions. Use it actively:
- When an upgrade appears in 50%+ of quotes, mention it as "our most popular choice" or "most customers add this"
- When the 48V rate is high (60%+), pitch it early and confidently — not as a question but as "what most of our customers go with"
- When recommending a package, if the popularity data shows a tier is dominant, lead with that tier and reference the data naturally: "this is the setup most of our [commercial/car] customers go with"
- VOLUME SEGMENTS: The popularity data includes breakdowns by kit type — fully-auto T2000 operators (higher-throughput, 20+ jobs/day) vs semi-auto T1000 operators (standard volume). Use config.dailyJobVolume to drive this:
  → If dailyJobVolume is "high" (20+ jobs/day), cross-reference the high-volume segment — say things like "operators doing a high volume of jobs a day who go for the fully-auto setup tend to choose [tier] — it's the setup that keeps up with that kind of throughput"
  → If dailyJobVolume is "standard" (under 20 jobs/day), reference what standard-volume customers typically choose
  → If dailyJobVolume is null (not yet asked), ask Q2 before making volume-based segment comparisons
  → Frame it naturally — never cite numbers, say "most high-throughput operators", "the majority of fully-auto customers", "operators running at your kind of volume typically go with", etc.
- Never cite raw percentages or numbers to the customer — translate data into natural sales language: "most", "the majority", "eight out of ten", "our most popular setup", etc.
- If popularity data is unavailable, fall back to general best-practice recommendations as normal
${maxBusinessContext ? `\nBUSINESS CONTEXT (added by the team — treat this as ground truth for anything it covers):\n${maxBusinessContext}` : ""}

RESPONSE FORMAT:
You MUST always respond with valid JSON only — no other text outside the JSON. Use this exact structure:
{
  "message": "Your conversational message to the customer (this is shown directly to the user)",
  "config": {
    "ownVan": true/false/null,
    "vanSize": "MWB" or "LWB" or null,
    "serviceType": "car" or "commercial" or "hybrid" or null,
    "isEuro6": true/false/null,
    "dailyJobVolume": "high" or "standard" or null,
    "machineType": "semi-auto" or "fully-auto" or null,
    "packageId": "bronze" or "silver" or "gold" or null,
    "kitId": "<exact id from list above>" or null,
    "upgradeIds": ["<exact id>", ...],
    "financePlanId": "<exact id from list>" or null,
    "financePreference": "outright" or "lease" or "finance" or null,
    "includes48v": true or false,
    "contactName": null or "name string",
    "contactPhone": null or "phone string"
  },
  "stage": "chat" or "summary",
  "trackers": {
    "was48vPitched": true or false,
    "responseToThis48v": "yes" or "objection" or "soft_no" or "hard_no" or null,
    "suggestedUpgradeIds": ["<id>", ...],
    "addedUpgradeIds": ["<id>", ...]
  }
}

Set stage to "summary" when you have gathered enough information and want to present the full configuration summary to the customer. At summary stage, your message should be a brief wrap-up; the UI will display the full config card separately.
Only use IDs that appear in the lists above. Never invent IDs. Update config progressively as you learn more.`;

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      // If a name was pre-captured in the form and this is the opening __GREET__ trigger,
      // inject a synthetic Q0 exchange into the message history so Max sees the name was
      // already given and skips straight to Q1 — much more reliable than a prompt instruction.
      const isGreetTrigger = messages.length === 1 && messages[0].content === "__GREET__";
      let effectiveMessages: Array<{ role: "user" | "assistant"; content: string }>;
      if (contactName && isGreetTrigger) {
        effectiveMessages = [
          { role: "user", content: `Hi, my name is ${contactName}.` },
        ];
      } else {
        effectiveMessages = messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
      }

      const aiPayload = {
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...effectiveMessages,
        ] as any,
        response_format: { type: "json_object" as const },
        temperature: 0.7,
      };

      let completion;
      try {
        completion = await openai.chat.completions.create(aiPayload);
      } catch (firstErr: any) {
        if (firstErr?.status === 429) {
          // Rate limited — wait 4 seconds and try once more
          await new Promise(r => setTimeout(r, 4000));
          completion = await openai.chat.completions.create(aiPayload);
        } else {
          throw firstErr;
        }
      }

      const rawContent = completion.choices[0]?.message?.content ?? "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        parsed = {
          message: "Sorry, I had a little technical hiccup. Could you repeat that?",
          config: {},
          stage: "chat",
          trackers: { was48vPitched: false, responseToThis48v: null, suggestedUpgradeIds: [], addedUpgradeIds: [] },
        };
      }

      res.json(parsed);
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({
        error: "AI temporarily unavailable",
        message: "Our AI assistant is temporarily unavailable. You can still build your van using our standard configurator.",
      });
    }
  });

  app.post("/api/ai-chat/save", async (req, res) => {
    try {
      const {
        sessionId, status, messages, config, trackers,
        contactName, contactPhone,
      } = req.body;

      const cfg = config ?? {};
      const trk = trackers ?? {};

      await pool.query(
        `INSERT INTO ai_conversations (
          session_id, status, messages, mapped_config,
          contact_name, contact_phone,
          van_type, van_size, spec_level, finance_preference,
          includes_48v, was_48v_pitched, response_to_48v,
          suggested_upgrade_ids, added_upgrade_ids,
          config_completed, completed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (session_id) DO UPDATE SET
          status = EXCLUDED.status,
          messages = EXCLUDED.messages,
          mapped_config = EXCLUDED.mapped_config,
          contact_name = COALESCE(EXCLUDED.contact_name, ai_conversations.contact_name),
          contact_phone = COALESCE(EXCLUDED.contact_phone, ai_conversations.contact_phone),
          van_type = EXCLUDED.van_type,
          van_size = EXCLUDED.van_size,
          spec_level = EXCLUDED.spec_level,
          finance_preference = EXCLUDED.finance_preference,
          includes_48v = EXCLUDED.includes_48v,
          was_48v_pitched = EXCLUDED.was_48v_pitched,
          response_to_48v = EXCLUDED.response_to_48v,
          suggested_upgrade_ids = EXCLUDED.suggested_upgrade_ids,
          added_upgrade_ids = EXCLUDED.added_upgrade_ids,
          config_completed = EXCLUDED.config_completed,
          completed_at = COALESCE(EXCLUDED.completed_at, ai_conversations.completed_at)`,
        [
          sessionId,
          status ?? "in_progress",
          JSON.stringify(messages ?? []),
          JSON.stringify(cfg),
          contactName ?? cfg.contactName ?? null,
          contactPhone ?? cfg.contactPhone ?? null,
          cfg.serviceType ?? null,
          cfg.vanSize ?? null,
          cfg.kitId ?? null,
          cfg.financePreference ?? null,
          cfg.includes48v ?? false,
          trk.was48vPitched ?? false,
          trk.responseToThis48v ?? null,
          JSON.stringify(trk.suggestedUpgradeIds ?? []),
          JSON.stringify(trk.addedUpgradeIds ?? []),
          status === "completed",
          status === "completed" ? new Date() : null,
        ]
      );

      // When a Max conversation completes, auto-create a draft quote so it appears in
      // the Configurators list immediately — even if the customer never submits the form.
      if (status === "completed" && sessionId) {
        try {
          const existing = await pool.query(
            `SELECT id, est_total, kit_id FROM quotes WHERE ai_session_id = $1 LIMIT 1`,
            [sessionId]
          );

          const upgradeIds = Array.isArray(cfg.upgradeIds) ? cfg.upgradeIds : [];

          // Always recalculate pricing from the latest cfg so we pick up kitId/upgradeIds
          // that may have been captured after the quote was first auto-created at £0.
          let kitPricePence = 0;
          if (cfg.kitId) {
            const kitRow = await pool.query(`SELECT price FROM kits WHERE id = $1 LIMIT 1`, [cfg.kitId]);
            if (kitRow.rows.length > 0) kitPricePence = kitRow.rows[0].price ?? 0;
          }
          let upgradesPricePence = 0;
          if (upgradeIds.length > 0) {
            const upRow = await pool.query(
              `SELECT COALESCE(SUM(price), 0) AS total FROM upgrades WHERE id = ANY($1::text[])`,
              [upgradeIds]
            );
            upgradesPricePence = parseInt(upRow.rows[0]?.total ?? "0", 10);
          }
          const estSubtotal = kitPricePence + upgradesPricePence;
          const estVat = Math.round(estSubtotal * 0.2);
          const estTotal = estSubtotal + estVat;

          if (existing.rows.length === 0) {
            // No quote yet — create one
            let customVanDescription: string | null = null;
            if (cfg.ownVan === false && cfg.vanSize) {
              customVanDescription = `${cfg.vanSize} van supplied by ${BRAND.name}`;
            } else if (cfg.ownVan === true) {
              customVanDescription = "Customer's own van";
            }

            const autoName = (contactName ?? cfg.contactName ?? "").trim() || "Via Max (name pending)";
            const autoPhone = (contactPhone ?? cfg.contactPhone ?? "").trim();

            await pool.query(
              `INSERT INTO quotes (
                user_name, email, phone, service_type, kit_id,
                selected_upgrade_ids, selected_upgrades, training_option_ids,
                finance_plan_id, custom_van_description,
                est_subtotal, est_vat, est_total, est_discount,
                ai_session_id, status, admin_notes_history
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
              [
                autoName,
                "",
                autoPhone,
                cfg.serviceType ?? null,
                cfg.kitId ?? null,
                JSON.stringify(upgradeIds),
                JSON.stringify({}),
                JSON.stringify([]),
                cfg.financePlanId ?? null,
                customVanDescription,
                estSubtotal, estVat, estTotal, 0,
                sessionId,
                "new",
                JSON.stringify([{
                  text: "Auto-created from Max AI chat — customer completed the configuration but may not have submitted the quote form. Phone number captured from Max chat.",
                  timestamp: new Date().toISOString(),
                  author: "System",
                }]),
              ]
            );
          } else if (existing.rows[0].est_total === 0 && estTotal > 0) {
            // Quote already exists but was created before kitId was known — update its pricing and config
            await pool.query(
              `UPDATE quotes SET
                kit_id = $1,
                selected_upgrade_ids = $2,
                est_subtotal = $3,
                est_vat = $4,
                est_total = $5
              WHERE id = $6`,
              [
                cfg.kitId ?? null,
                JSON.stringify(upgradeIds),
                estSubtotal, estVat, estTotal,
                existing.rows[0].id,
              ]
            );
          }
        } catch (autoErr: any) {
          // Non-fatal — log but don't fail the save response
          console.error("Auto-quote creation error:", autoErr.message);
        }
      }

      // Auto-link / create a unified Customer record when the conversation is completed.
      // We read from the DB row after the upsert so that contact details persisted by
      // earlier in-progress saves (stored via COALESCE for contact_phone/contact_name,
      // and in mapped_config for contactEmail) are used even if the final "completed"
      // save request does not re-include them in its config payload.
      // Awaited before responding so the customer link is guaranteed to have committed
      // by the time the caller receives { ok: true }.
      if (status === "completed") {
        try {
          const { rows: [saved] } = await pool.query(
            `SELECT mapped_config, contact_name, contact_phone FROM ai_conversations WHERE session_id = $1`,
            [sessionId]
          );
          if (saved) {
            const savedCfg = typeof saved.mapped_config === "string"
              ? JSON.parse(saved.mapped_config)
              : (saved.mapped_config ?? {});
            const resolvedEmail = (savedCfg.contactEmail ?? "").trim() || null;
            const resolvedPhone = (savedCfg.contactPhone ?? saved.contact_phone ?? "").trim() || null;
            const resolvedName = (savedCfg.contactName ?? saved.contact_name ?? "").trim() || "AI Chat Contact";

            // Patch the quote's user_name if it was left as the placeholder because
            // the name was persisted in an earlier save but not re-sent in the
            // final "completed" payload.
            const realName = (savedCfg.contactName ?? saved.contact_name ?? "").trim();
            if (realName) {
              await pool.query(
                `UPDATE quotes SET user_name = $1 WHERE ai_session_id = $2 AND user_name = $3`,
                [realName, sessionId, "Via Max (name pending)"]
              );
            }

            if (resolvedEmail || resolvedPhone) {
              const customer = await storage.findOrCreateCustomer(resolvedEmail, resolvedPhone, resolvedName);
              await storage.linkConversationBySessionToCustomer(sessionId, customer.id);
              storage.backfillLeadsAndQuotesForCustomer(customer.id, resolvedEmail, resolvedPhone)
                .catch(err => console.error("Customer backfill (ai-conversation) error:", err?.message));
            }
          }
        } catch (err: any) {
          // Non-fatal — log but don't fail the save response
          console.error("Customer auto-link (ai-conversation) error:", err?.message);
        }
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("AI chat save error:", error);
      res.status(500).json({ error: "Failed to save conversation" });
    }
  });

  app.get("/api/admin/ai-conversations", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { status, includes48v, dateFrom, dateTo, limit = "50", offset = "0" } = req.query as Record<string, string>;

      let where = "WHERE 1=1";
      const params: any[] = [];
      let idx = 1;

      if (status) { where += ` AND ac.status = $${idx++}`; params.push(status); }
      if (includes48v !== undefined) { where += ` AND ac.includes_48v = $${idx++}`; params.push(includes48v === "true"); }
      if (dateFrom) { where += ` AND ac.created_at >= $${idx++}`; params.push(new Date(dateFrom)); }
      if (dateTo) { where += ` AND ac.created_at <= $${idx++}`; params.push(new Date(dateTo)); }

      const [rows, stats] = await Promise.all([
        pool.query(
          `SELECT ac.id, ac.session_id, ac.status,
                  COALESCE(ac.contact_name, q.user_name) AS contact_name,
                  COALESCE(ac.contact_phone, q.phone) AS contact_phone,
                  ac.van_type, ac.van_size, ac.spec_level,
                  ac.finance_preference, ac.includes_48v, ac.was_48v_pitched,
                  ac.response_to_48v, ac.config_completed,
                  ac.marked_contacted, ac.contacted_note, ac.created_at, ac.completed_at,
                  q.id AS linked_quote_id
           FROM ai_conversations ac
           LEFT JOIN quotes q ON q.ai_session_id = ac.session_id
           ${where}
           ORDER BY ac.created_at DESC
           LIMIT $${idx} OFFSET $${idx + 1}`,
          [...params, parseInt(limit), parseInt(offset)]
        ),
        pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW())) AS total_this_month,
            COUNT(*) FILTER (WHERE config_completed AND created_at >= date_trunc('month', NOW())) AS completed_this_month,
            COUNT(*) FILTER (WHERE includes_48v AND created_at >= date_trunc('month', NOW())) AS includes_48v_this_month,
            COUNT(*) FILTER (WHERE (contact_name IS NOT NULL OR contact_phone IS NOT NULL) AND created_at >= date_trunc('month', NOW())) AS leads_captured_this_month
          FROM ai_conversations
        `),
      ]);

      const s = stats.rows[0];
      const totalThisMonth = parseInt(s.total_this_month) || 0;
      const completedThisMonth = parseInt(s.completed_this_month) || 0;
      const includes48vThisMonth = parseInt(s.includes_48v_this_month) || 0;
      const leadsCapturedThisMonth = parseInt(s.leads_captured_this_month) || 0;

      res.json({
        conversations: rows.rows,
        stats: {
          totalThisMonth,
          completionRate: totalThisMonth > 0 ? Math.round((completedThisMonth / totalThisMonth) * 100) : 0,
          fortyEightVConversionRate: totalThisMonth > 0 ? Math.round((includes48vThisMonth / totalThisMonth) * 100) : 0,
          leadCaptureRate: totalThisMonth > 0 ? Math.round((leadsCapturedThisMonth / totalThisMonth) * 100) : 0,
          leadsCapturedThisMonth,
        },
      });
    } catch (error) {
      console.error("AI conversations list error:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Static routes MUST come before parameterised /:id routes
  app.get("/api/admin/ai-conversations/export/count", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const { status, dateFrom, dateTo, markedContacted } = req.query as Record<string, string | undefined>;

      if (status && status !== "all") {
        conditions.push(`status = $${idx++}`);
        values.push(status);
      }
      if (dateFrom) {
        conditions.push(`created_at >= $${idx++}`);
        values.push(new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        conditions.push(`created_at <= $${idx++}`);
        values.push(new Date(dateTo).toISOString());
      }
      if (markedContacted === "yes") {
        conditions.push(`marked_contacted = true`);
      } else if (markedContacted === "no") {
        conditions.push(`marked_contacted = false`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS count FROM ai_conversations ${where}`,
        values
      );

      res.json({ count: parseInt(rows[0].count, 10) });
    } catch (error) {
      console.error("AI CSV export count error:", error);
      res.status(500).json({ error: "Count failed" });
    }
  });

  app.get("/api/admin/ai-conversations/export/csv", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const conditions: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const { status, dateFrom, dateTo, markedContacted } = req.query as Record<string, string | undefined>;

      if (status && status !== "all") {
        conditions.push(`status = $${idx++}`);
        values.push(status);
      }
      if (dateFrom) {
        conditions.push(`created_at >= $${idx++}`);
        values.push(new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        conditions.push(`created_at <= $${idx++}`);
        values.push(new Date(dateTo).toISOString());
      }
      if (markedContacted === "yes") {
        conditions.push(`marked_contacted = true`);
      } else if (markedContacted === "no") {
        conditions.push(`marked_contacted = false`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const { rows } = await pool.query(
        `SELECT id, session_id, status, contact_name, contact_phone, van_type, van_size,
                finance_preference, includes_48v, was_48v_pitched, response_to_48v,
                config_completed, marked_contacted, contacted_note, created_at
         FROM ai_conversations ${where} ORDER BY created_at DESC`,
        values
      );

      const header = "ID,Session ID,Status,Name,Phone,Van Type,Van Size,Finance,48V,48V Pitched,48V Response,Config Completed,Contacted,Call Note,Created At\n";
      const csvRows = rows.map(r =>
        [
          r.id, r.session_id, r.status,
          r.contact_name ?? "", r.contact_phone ?? "",
          r.van_type ?? "", r.van_size ?? "",
          r.finance_preference ?? "",
          r.includes_48v ? "Yes" : "No",
          r.was_48v_pitched ? "Yes" : "No",
          r.response_to_48v ?? "",
          r.config_completed ? "Yes" : "No",
          r.marked_contacted ? "Yes" : "No",
          r.contacted_note ?? "",
          new Date(r.created_at).toISOString(),
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="ai-conversations-${Date.now()}.csv"`);
      res.send(header + csvRows);
    } catch (error) {
      console.error("AI CSV export error:", error);
      res.status(500).json({ error: "Export failed" });
    }
  });

  app.get("/api/admin/ai-conversations/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM ai_conversations WHERE id = $1",
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Not found" });
      res.json(rows[0]);
    } catch (error) {
      console.error("AI conversation detail error:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.patch("/api/admin/ai-conversations/:id/contact", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const schema_z = z.object({
        name: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
      });
      const data = schema_z.parse(req.body);

      const { rows } = await pool.query(
        "SELECT id, session_id, contact_name, contact_phone, mapped_config FROM ai_conversations WHERE id = $1",
        [id]
      );
      if (!rows[0]) return res.status(404).json({ error: "Not found" });

      const existing = rows[0];
      const updatedName = data.name !== undefined ? (data.name ?? null) : existing.contact_name;
      const updatedPhone = data.phone !== undefined ? (data.phone ?? null) : existing.contact_phone;

      let cfg: Record<string, unknown> | null = null;
      if (existing.mapped_config) {
        cfg = typeof existing.mapped_config === "string"
          ? JSON.parse(existing.mapped_config)
          : { ...existing.mapped_config };
      }
      if (data.email !== undefined) {
        cfg = cfg ?? {};
        cfg.contactEmail = data.email ?? null;
      }
      const updatedEmail = ((cfg?.contactEmail) as string | null | undefined) ?? null;

      await pool.query(
        `UPDATE ai_conversations
         SET contact_name = $2,
             contact_phone = $3,
             mapped_config = CASE WHEN $4::text IS NULL THEN mapped_config ELSE $4::jsonb END
         WHERE id = $1`,
        [id, updatedName, updatedPhone, cfg !== null ? JSON.stringify(cfg) : null]
      );

      if (updatedEmail || updatedPhone) {
        try {
          const effectiveName = (updatedName ?? "").trim() || "AI Chat Contact";
          const customer = await storage.findOrCreateCustomer(updatedEmail || null, updatedPhone || null, effectiveName);
          if (existing.session_id) {
            await storage.linkConversationBySessionToCustomer(existing.session_id, customer.id, "System (auto-link)");
          } else {
            console.warn("[AI conv contact edit] no session_id — falling back to id-based link for conv", id);
            await storage.linkConversationToCustomer(id, customer.id, "System (auto-link)");
          }
        } catch (linkErr) {
          console.error("[AI conv contact edit] re-link error:", (linkErr as Error).message);
        }
      }

      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      console.error("AI conversation update contact error:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.patch("/api/admin/ai-conversations/:id/contacted", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;

      // Fetch conversation so we know the linked customer_id
      const convResult = await pool.query(
        "SELECT id, customer_id, contact_name FROM ai_conversations WHERE id = $1",
        [req.params.id]
      );
      if (convResult.rows.length === 0) return res.status(404).json({ error: "Not found" });
      const conv = convResult.rows[0];

      await pool.query(
        "UPDATE ai_conversations SET marked_contacted = TRUE, contacted_note = $2 WHERE id = $1",
        [req.params.id, note || null]
      );

      // If a note was provided and the conversation is linked to a customer, save it to the customer timeline
      if (note && conv.customer_id) {
        const authorName = req.session.user?.username ?? "Admin";
        const authorId = req.session.user?.id ?? null;
        const timestamp = new Date().toISOString();
        const noteEntry = { text: note, timestamp, author: authorName };

        // Insert customer note (type: call)
        await pool.query(
          `INSERT INTO customer_notes (id, customer_id, author_id, author_name, note_type, text, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, 'call', $4, NOW())`,
          [conv.customer_id, authorId, authorName, note]
        );

        // Propagate to linked leads and quotes
        const [linkedLeads, linkedQuotes] = await Promise.all([
          pool.query(`SELECT id, crm_notes FROM leads WHERE customer_id = $1`, [conv.customer_id]),
          pool.query(`SELECT id, admin_notes_history FROM quotes WHERE customer_id = $1`, [conv.customer_id]),
        ]);

        await Promise.all([
          ...linkedLeads.rows.map((lead: any) => {
            const existing: Array<{ text: string; timestamp: string; author?: string }> = lead.crm_notes ?? [];
            return pool.query(
              `UPDATE leads SET crm_notes = $2 WHERE id = $1`,
              [lead.id, JSON.stringify([...existing, noteEntry])]
            );
          }),
          ...linkedQuotes.rows.map((quote: any) => {
            const existing: Array<{ text: string; timestamp: string; author?: string }> = quote.admin_notes_history ?? [];
            return pool.query(
              `UPDATE quotes SET admin_notes_history = $2 WHERE id = $1`,
              [quote.id, JSON.stringify([...existing, noteEntry])]
            );
          }),
        ]);
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("AI conversation mark contacted error:", error);
      res.status(500).json({ error: "Failed to update" });
    }
  });

  // ─── Admin: Max AI Analytics ─────────────────────────────────────────────
  app.get("/api/admin/analytics/ai", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const [allTime, thisMonth, daily, statusBreakdown] = await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)                                                                 AS total,
            COUNT(*) FILTER (WHERE status = 'completed')                            AS completed,
            COUNT(*) FILTER (WHERE status = 'abandoned')                            AS abandoned,
            COUNT(*) FILTER (WHERE status = 'in_progress')                          AS in_progress,
            COUNT(*) FILTER (WHERE contact_name IS NOT NULL OR contact_phone IS NOT NULL) AS leads_captured,
            COUNT(*) FILTER (WHERE includes_48v = TRUE)                             AS includes_48v,
            COUNT(*) FILTER (WHERE was_48v_pitched = TRUE)                          AS pitched_48v,
            COUNT(*) FILTER (WHERE config_completed = TRUE)                         AS config_completed
          FROM ai_conversations
        `),
        pool.query(`
          SELECT
            COUNT(*)                                                                 AS total,
            COUNT(*) FILTER (WHERE status = 'completed')                            AS completed,
            COUNT(*) FILTER (WHERE status = 'abandoned')                            AS abandoned,
            COUNT(*) FILTER (WHERE status = 'in_progress')                          AS in_progress,
            COUNT(*) FILTER (WHERE contact_name IS NOT NULL OR contact_phone IS NOT NULL) AS leads_captured,
            COUNT(*) FILTER (WHERE includes_48v = TRUE)                             AS includes_48v,
            COUNT(*) FILTER (WHERE was_48v_pitched = TRUE)                          AS pitched_48v,
            COUNT(*) FILTER (WHERE config_completed = TRUE)                         AS config_completed
          FROM ai_conversations
          WHERE created_at >= date_trunc('month', NOW())
        `),
        pool.query(`
          SELECT
            TO_CHAR(DATE(created_at), 'YYYY-MM-DD')                                 AS date,
            COUNT(*)                                                                 AS total,
            COUNT(*) FILTER (WHERE status = 'completed')                            AS completed,
            COUNT(*) FILTER (WHERE status = 'abandoned')                            AS abandoned,
            COUNT(*) FILTER (WHERE contact_name IS NOT NULL OR contact_phone IS NOT NULL) AS leads
          FROM ai_conversations
          WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC
        `),
        pool.query(`
          SELECT status, COUNT(*) AS count
          FROM ai_conversations
          GROUP BY status
          ORDER BY count DESC
        `),
      ]);

      const a = allTime.rows[0];
      const m = thisMonth.rows[0];

      const pct = (n: string, d: string) =>
        parseInt(d) > 0 ? Math.round((parseInt(n) / parseInt(d)) * 100) : 0;

      res.json({
        allTime: {
          total:           parseInt(a.total)          || 0,
          completed:       parseInt(a.completed)      || 0,
          abandoned:       parseInt(a.abandoned)      || 0,
          inProgress:      parseInt(a.in_progress)    || 0,
          leadsCapured:    parseInt(a.leads_captured) || 0,
          includes48v:     parseInt(a.includes_48v)   || 0,
          pitched48v:      parseInt(a.pitched_48v)    || 0,
          configCompleted: parseInt(a.config_completed) || 0,
          completionRate:  pct(a.completed,      a.total),
          leadCaptureRate: pct(a.leads_captured, a.total),
          v48PitchRate:    pct(a.pitched_48v,    a.total),
          v48ConvRate:     pct(a.includes_48v,   a.pitched_48v),
        },
        thisMonth: {
          total:           parseInt(m.total)          || 0,
          completed:       parseInt(m.completed)      || 0,
          abandoned:       parseInt(m.abandoned)      || 0,
          inProgress:      parseInt(m.in_progress)    || 0,
          leadsCapured:    parseInt(m.leads_captured) || 0,
          includes48v:     parseInt(m.includes_48v)   || 0,
          pitched48v:      parseInt(m.pitched_48v)    || 0,
          configCompleted: parseInt(m.config_completed) || 0,
          completionRate:  pct(m.completed,      m.total),
          leadCaptureRate: pct(m.leads_captured, m.total),
          v48PitchRate:    pct(m.pitched_48v,    m.total),
          v48ConvRate:     pct(m.includes_48v,   m.pitched_48v),
        },
        daily: daily.rows.map((r: any) => ({
          date:      r.date,
          total:     parseInt(r.total)     || 0,
          completed: parseInt(r.completed) || 0,
          abandoned: parseInt(r.abandoned) || 0,
          leads:     parseInt(r.leads)     || 0,
        })),
        statusBreakdown: statusBreakdown.rows.map((r: any) => ({
          status: r.status,
          count:  parseInt(r.count) || 0,
        })),
      });
    } catch (error) {
      console.error("AI analytics error:", error);
      res.status(500).json({ error: "Failed to fetch AI analytics" });
    }
  });

  // ─── Admin: AI Packages (Bronze / Silver / Gold) ─────────────────────────
  app.get("/api/admin/ai-packages", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM ai_packages ORDER BY tier ASC");
      res.json(result.rows);
    } catch (error) {
      console.error("AI packages fetch error:", error);
      res.status(500).json({ error: "Failed to fetch packages" });
    }
  });

  app.patch("/api/admin/ai-packages/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { description, recommendedFor, upgradeIds, active } = req.body;
      const result = await pool.query(
        `UPDATE ai_packages SET
          description = COALESCE($1, description),
          recommended_for = COALESCE($2, recommended_for),
          upgrade_ids = COALESCE($3::jsonb, upgrade_ids),
          active = COALESCE($4, active)
         WHERE id = $5 RETURNING *`,
        [
          description ?? null,
          recommendedFor ?? null,
          upgradeIds !== undefined ? JSON.stringify(upgradeIds) : null,
          active !== undefined ? active : null,
          id,
        ]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "Package not found" });
      res.json(result.rows[0]);
    } catch (error) {
      console.error("AI package update error:", error);
      res.status(500).json({ error: "Failed to update package" });
    }
  });

  // ── Email preview routes ──────────────────────────────────────────────────
  app.get("/api/admin/email-preview/templates", isAuthenticated, isBasicAdmin, async (_req, res) => {
    const { EMAIL_TEMPLATES, LIVE_SEND_TEMPLATE_IDS } = await import('./email-previews.js');
    res.json(EMAIL_TEMPLATES.map((t: { id: string }) => ({
      ...t,
      liveSend: LIVE_SEND_TEMPLATE_IDS.has(t.id),
    })));
  });

  app.get("/api/admin/email-preview/html/:template", isAuthenticated, isBasicAdmin, async (req, res) => {
    const { generatePreviewHtml } = await import('./email-previews.js');
    let html = generatePreviewHtml(req.params.template);
    if (!html) return res.status(404).json({ error: "Template not found" });
    // Replace the production logo URL with one served from this server so the
    // logo renders correctly in development and staging environments.
    const localBase = `${req.protocol}://${req.get('host')}`;
    html = html.replace(/https?:\/\/[^"]*LOGO_1762356342150\.png/g, `${localBase}/LOGO_1762356342150.png`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  app.post("/api/admin/email-preview/send-test", isAuthenticated, isBasicAdmin, async (req, res) => {
    const schema = z.object({
      to: z.string().email(),
      templateId: z.string(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });

    const { to, templateId } = parsed.data;
    try {
      const {
        SPEC_SUMMARY_TEST_ARGS,
        QUOTE_SPEC_SUMMARY_TEST_ARGS,
        QUOTE_CONFIRMATION_TEST_ARGS,
        FINANCE_SUBMISSION_TEST_ARGS,
        OPTION_CHOSEN_ADMIN_TEST_ARGS,
        DEPOT_INVOICE_TEST_ARGS,
        TESTIMONIAL_REQUEST_TEST_ARGS,
        ENQUIRY_RECEIVED_TEST_ARGS,
        LEAD_RECEIVED_TEST_ARGS,
        WELCOME_EMAIL_TEST_ARGS,
        SET_PASSWORD_TEST_ARGS,
        PASSWORD_RESET_TEST_ARGS,
        EMAIL_TEMPLATES,
      } = await import('./email-previews.js');

      const templateLabel = EMAIL_TEMPLATES.find((t: { id: string }) => t.id === templateId)?.label ?? templateId;

      // ── Spec Summary (older flow) ──────────────────────────────────────────
      if (templateId === 'spec-summary-single' || templateId === 'spec-summary-comparison') {
        const { sendQuoteSpecSummaryEmail } = await import('./email.js');
        const fixture = templateId === 'spec-summary-comparison'
          ? SPEC_SUMMARY_TEST_ARGS.comparison
          : SPEC_SUMMARY_TEST_ARGS.single;
        await sendQuoteSpecSummaryEmail({ to, ...fixture });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Quote Spec Summary ─────────────────────────────────────────────────
      if (templateId === 'quote-spec-summary-single' || templateId === 'quote-spec-summary-comparison') {
        const { sendQuoteSpecSummaryEmail } = await import('./email.js');
        const fixture = templateId === 'quote-spec-summary-comparison'
          ? QUOTE_SPEC_SUMMARY_TEST_ARGS.comparison
          : QUOTE_SPEC_SUMMARY_TEST_ARGS.single;
        await sendQuoteSpecSummaryEmail({ to, ...fixture });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Quote Confirmation ─────────────────────────────────────────────────
      if (templateId === 'quote-confirmation') {
        const { sendQuoteConfirmationEmail } = await import('./email.js');
        await sendQuoteConfirmationEmail({ to, ...QUOTE_CONFIRMATION_TEST_ARGS });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Finance Submission ─────────────────────────────────────────────────
      if (templateId === 'finance-submission') {
        const { sendFinanceSubmissionEmail } = await import('./email.js');
        await sendFinanceSubmissionEmail({ financeCompanyEmail: to, ...FINANCE_SUBMISSION_TEST_ARGS });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Option Chosen (Admin) ──────────────────────────────────────────────
      if (templateId === 'option-chosen-admin') {
        const { sendOptionChosenAdminNotification } = await import('./email.js');
        await sendOptionChosenAdminNotification({ toOverride: to, ...OPTION_CHOSEN_ADMIN_TEST_ARGS });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Depot Invoice ──────────────────────────────────────────────────────
      if (templateId === 'depot-invoice') {
        const { sendDepotInvoiceEmail } = await import('./email.js');
        await sendDepotInvoiceEmail({ toOverride: to, ...DEPOT_INVOICE_TEST_ARGS });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Testimonial / Review Request ───────────────────────────────────────
      if (templateId === 'testimonial-request') {
        const { sendTestimonialRequestEmail } = await import('./email.js');
        await sendTestimonialRequestEmail({ to, ...TESTIMONIAL_REQUEST_TEST_ARGS });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Enquiry Received (Customer) ────────────────────────────────────────
      // Routes customer email to tester; admin notification goes to internal inboxes.
      if (templateId === 'enquiry-received-customer') {
        const { sendQuoteReceivedEmails } = await import('./email.js');
        const fixture = {
          ...ENQUIRY_RECEIVED_TEST_ARGS,
          quote: { ...ENQUIRY_RECEIVED_TEST_ARGS.quote, email: to },
          testMode: { variant: 'customer' as const, testAddress: to },
        };
        await sendQuoteReceivedEmails(fixture);
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Enquiry Received (Admin) ───────────────────────────────────────────
      // Routes admin notification to tester; customer email suppressed.
      if (templateId === 'enquiry-received-admin') {
        const { sendQuoteReceivedEmails } = await import('./email.js');
        const fixture = {
          ...ENQUIRY_RECEIVED_TEST_ARGS,
          quote: { ...ENQUIRY_RECEIVED_TEST_ARGS.quote, email: to },
          testMode: { variant: 'admin' as const, testAddress: to },
        };
        await sendQuoteReceivedEmails(fixture);
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Lead Received (Customer) ───────────────────────────────────────────
      // Routes customer email to tester; admin notification goes to internal inboxes.
      if (templateId === 'lead-received-customer') {
        const { sendLeadReceivedEmails } = await import('./email.js');
        await sendLeadReceivedEmails({
          ...LEAD_RECEIVED_TEST_ARGS,
          email: to,
          testMode: { variant: 'customer' as const, testAddress: to },
        });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Lead Received (Admin) ──────────────────────────────────────────────
      // Routes admin notification to tester; customer email suppressed.
      if (templateId === 'lead-received-admin') {
        const { sendLeadReceivedEmails } = await import('./email.js');
        await sendLeadReceivedEmails({
          ...LEAD_RECEIVED_TEST_ARGS,
          email: to,
          testMode: { variant: 'admin' as const, testAddress: to },
        });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── New User Welcome ───────────────────────────────────────────────────
      if (templateId === 'welcome-email') {
        const { sendNewUserWelcomeEmail } = await import('./email.js');
        await sendNewUserWelcomeEmail({ toEmail: to, ...WELCOME_EMAIL_TEST_ARGS });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Set Password (New User) ────────────────────────────────────────────
      if (templateId === 'set-password') {
        const { sendNewUserSetPasswordEmail } = await import('./email.js');
        await sendNewUserSetPasswordEmail({ toEmail: to, ...SET_PASSWORD_TEST_ARGS });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      // ── Password Reset ─────────────────────────────────────────────────────
      if (templateId === 'password-reset') {
        const { sendPasswordResetEmail } = await import('./email.js');
        await sendPasswordResetEmail({ toEmail: to, ...PASSWORD_RESET_TEST_ARGS });
        res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
        return;
      }

      const { generatePreviewHtml } = await import('./email-previews.js');
      const html = generatePreviewHtml(templateId);
      if (!html) return res.status(404).json({ error: "Template not found" });

      const template = EMAIL_TEMPLATES.find((t: { id: string }) => t.id === templateId);
      const subject = template ? `[TEST] ${template.subject}` : `[TEST] Email Preview – ${templateId}`;

      const { sendEmail } = await import('./email.js');
      await sendEmail({ to, subject, html });
      res.json({ ok: true, message: `Test email sent to ${to}`, templateLabel });
    } catch (err: any) {
      console.error("[email-preview] send-test error:", err);
      res.status(500).json({ error: err?.message || "Failed to send test email" });
    }
  });

  // ── Accounting integrations (Sage / Xero / QuickBooks) ────────────────────
  // Each deployment picks its active provider via the accounting_provider
  // site setting. Legacy /api/sage/* routes stay wired for the existing UI.

  app.get("/api/accounting/status", isAuthenticated, isBasicAdmin, async (_req, res) => {
    try {
      const { getAccountingStatus } = await import("./accounting/index.js");
      res.json(await getAccountingStatus());
    } catch (err: any) {
      console.error("[Accounting] status error:", err);
      res.status(500).json({ error: "Failed to load accounting status" });
    }
  });

  app.post("/api/accounting/provider", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { provider } = z.object({ provider: z.enum(["sage", "xero", "quickbooks"]) }).parse(req.body);
      const { setActiveProvider } = await import("./accounting/index.js");
      await setActiveProvider(provider);
      res.json({ ok: true, active: provider });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid provider" });
      res.status(500).json({ error: "Failed to set accounting provider" });
    }
  });

  app.get("/api/accounting/:provider/auth", isAuthenticated, isFullAdmin, async (req, res) => {
    const { getProvider } = await import("./accounting/index.js");
    const provider = getProvider(req.params.provider);
    if (!provider) return res.status(404).json({ error: "Unknown accounting provider" });
    if (!provider.isConfigured()) {
      return res.status(400).json({ error: `${provider.label} API credentials are not configured for this deployment.` });
    }
    res.redirect(provider.getAuthUrl());
  });

  app.get("/api/accounting/:provider/callback", async (req, res) => {
    const { getProvider } = await import("./accounting/index.js");
    const provider = getProvider(req.params.provider);
    if (!provider) return res.status(404).send("Unknown accounting provider");
    try {
      await provider.handleCallback(req.query as Record<string, string | undefined>);
      res.redirect(`/admin/settings?accounting=${provider.key}-connected`);
    } catch (err: any) {
      console.error(`[Accounting] ${provider.key} OAuth callback error:`, err);
      res.redirect(`/admin/settings?accounting=${provider.key}-error`);
    }
  });

  app.post("/api/accounting/push/:quoteId", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { getActiveProvider, buildInvoiceFromQuote, recordInvoicePush } = await import("./accounting/index.js");
      const provider = await getActiveProvider();
      const invoice = await buildInvoiceFromQuote(req.params.quoteId);
      const result = await provider.pushInvoice(invoice);
      await recordInvoicePush(req.params.quoteId, provider.key, result.invoiceId, result.invoiceNumber);
      res.json({ ok: true, provider: provider.key, ...result });
    } catch (err: any) {
      console.error("[Accounting] Push invoice error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to push invoice." });
    }
  });

  app.delete("/api/accounting/:provider/disconnect", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { getProvider } = await import("./accounting/index.js");
      const provider = getProvider(req.params.provider);
      if (!provider) return res.status(404).json({ error: "Unknown accounting provider" });
      await provider.disconnect();
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to disconnect provider." });
    }
  });

  // Legacy Sage endpoints (existing admin UI + registered OAuth redirect URI)

  app.get("/api/sage/status", isAuthenticated, isBasicAdmin, async (_req, res) => {
    try {
      const { accountingProviders } = await import("./accounting/index.js");
      const connected = await accountingProviders.sage.isConnected();
      res.json({ connected });
    } catch {
      res.json({ connected: false });
    }
  });

  app.get("/api/sage/auth", isAuthenticated, isFullAdmin, async (_req, res) => {
    const { accountingProviders } = await import("./accounting/index.js");
    res.redirect(accountingProviders.sage.getAuthUrl());
  });

  app.get("/api/sage/callback", async (req, res) => {
    try {
      const { accountingProviders } = await import("./accounting/index.js");
      await accountingProviders.sage.handleCallback(req.query as Record<string, string | undefined>);
      res.redirect("/admin/settings?sage=connected");
    } catch (err: any) {
      console.error("[Sage] OAuth callback error:", err);
      res.redirect("/admin/settings?sage=error");
    }
  });

  app.post("/api/sage/push/:quoteId", isAuthenticated, isFullAdmin, async (req, res) => {
    const { quoteId } = req.params;
    try {
      // Pushes to the deployment's ACTIVE provider (Sage by default) so the
      // existing QuoteDetail button works regardless of provider choice.
      const { getActiveProvider, buildInvoiceFromQuote, recordInvoicePush } = await import("./accounting/index.js");
      const provider = await getActiveProvider();
      const invoice = await buildInvoiceFromQuote(quoteId);
      const result = await provider.pushInvoice(invoice);
      await recordInvoicePush(quoteId, provider.key, result.invoiceId, result.invoiceNumber);
      res.json({ ok: true, provider: provider.key, ...result });
    } catch (err: any) {
      console.error("[Accounting] Push invoice error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to push invoice." });
    }
  });

  app.delete("/api/sage/disconnect", isAuthenticated, isFullAdmin, async (_req, res) => {
    try {
      const { accountingProviders } = await import("./accounting/index.js");
      await accountingProviders.sage.disconnect();
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to disconnect Sage." });
    }
  });

  // ── Customer CRM Routes ────────────────────────────────────────────────────

  // Staff list for assignment dropdowns (basic admin+)
  app.get("/api/admin/staff", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      const staff = allUsers
        .filter(u => u.adminRole && u.adminRole !== "none")
        .map(u => ({
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          displayName:
            u.firstName && u.lastName
              ? `${u.firstName} ${u.lastName}`
              : u.username,
        }));
      res.json(staff);
    } catch (error) {
      console.error("Get staff error:", error);
      res.status(500).json({ error: "Failed to fetch staff" });
    }
  });

  // List customers (searchable, filterable by assigned staff)
  app.get("/api/admin/customers", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const staffId = req.query.staffId as string | undefined;
      let customers = await storage.getCustomers(search);

      // Filter by assigned staff if requested
      if (staffId === "unassigned") {
        customers = customers.filter(c => !c.primaryStaffId);
      } else if (staffId) {
        customers = customers.filter(c => c.primaryStaffId === staffId);
      }

      // Build a lookup of staff names
      const allUsers = await storage.getUsers();
      const staffMap = new Map(
        allUsers.map(u => [
          u.id,
          u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username,
        ])
      );

      // Enrich with linked record counts, last contact date, and current pipeline status
      const { rows } = await pool.query(`
        SELECT
          c.id,
          COUNT(DISTINCT l.id) AS lead_count,
          COUNT(DISTINCT q.id) AS quote_count,
          COUNT(DISTINCT ai.id) AS convo_count,
          COUNT(DISTINCT fu.id) FILTER (WHERE fu.completed = false) AS open_followup_count,
          GREATEST(
            MAX(l.created_at), MAX(q.created_at), MAX(ai.created_at)
          ) AS last_activity_at,
          -- Latest quote status takes precedence for pipeline status
          (SELECT q2.status FROM quotes q2 WHERE q2.customer_id = c.id ORDER BY q2.created_at DESC LIMIT 1) AS latest_quote_status,
          (SELECT l2.status FROM leads l2 WHERE l2.customer_id = c.id ORDER BY l2.created_at DESC LIMIT 1) AS latest_lead_status
        FROM customers c
        LEFT JOIN leads l ON l.customer_id = c.id
        LEFT JOIN quotes q ON q.customer_id = c.id
        LEFT JOIN ai_conversations ai ON ai.customer_id = c.id
        LEFT JOIN follow_ups fu ON (fu.lead_id = l.id OR fu.quote_id = q.id)
        ${customers.length > 0 ? `WHERE c.id = ANY($1::text[])` : "WHERE FALSE"}
        GROUP BY c.id
      `, customers.length > 0 ? [customers.map(c => c.id)] : []);

      const statsMap = new Map(rows.map((r: any) => [r.id, r]));

      const enriched = customers.map(c => {
        const s = statsMap.get(c.id) as any;
        const pipelineStatus = s?.latest_quote_status ?? s?.latest_lead_status ?? "new";
        return {
          ...c,
          leadCount: s ? parseInt(s.lead_count ?? "0") : 0,
          quoteCount: s ? parseInt(s.quote_count ?? "0") : 0,
          convoCount: s ? parseInt(s.convo_count ?? "0") : 0,
          openFollowUpCount: s ? parseInt(s.open_followup_count ?? "0") : 0,
          lastActivityAt: s?.last_activity_at ?? c.createdAt,
          pipelineStatus,
          primaryStaffName: c.primaryStaffId ? (staffMap.get(c.primaryStaffId) ?? null) : null,
        };
      });

      res.json(enriched);
    } catch (error) {
      console.error("Get customers error:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Get merge history — returns the most recent merges so staff can split them.
  // IMPORTANT: must be declared before /:id to avoid route shadowing.
  app.get("/api/admin/customers/merge-history", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const keepId = typeof req.query.keepId === "string" && req.query.keepId ? req.query.keepId : undefined;
      const history = await storage.getMergeHistory(limit, keepId);
      res.json(history);
    } catch (error) {
      console.error("Merge history fetch error:", error);
      res.status(500).json({ error: "Failed to fetch merge history" });
    }
  });

  // Split a merge: re-create the removed customer and re-link their records.
  app.post("/api/admin/customers/split/:historyId", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { historyId } = req.params;
      const splitBy = (req.session as any)?.user?.id ?? undefined;
      const result = await storage.splitMerge(historyId, splitBy);
      res.json({ ok: true, newCustomerId: result.newCustomerId });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Split merge error:", msg);
      if (msg === "Merge history entry not found") return res.status(404).json({ error: msg });
      if (msg === "This merge has already been split") return res.status(409).json({ error: msg });
      if (msg.startsWith("A customer with that email or phone already exists")) return res.status(409).json({ error: msg });
      res.status(500).json({ error: "Failed to split merge" });
    }
  });

  // Manual merge: merge two specific customers from the profile page.
  // keepId must be one of the two customers (defaults to :id if not provided).
  app.post("/api/admin/customers/:id/merge", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const schema_z = z.object({
        mergeWithId: z.string().min(1),
        keepId: z.string().min(1),
      });
      const { mergeWithId, keepId } = schema_z.parse(req.body);

      // Validate: keepId must be one of the two involved customers.
      if (keepId !== id && keepId !== mergeWithId) {
        return res.status(400).json({ error: "keepId must be one of the two customers being merged" });
      }
      const removeId = keepId === id ? mergeWithId : id;

      // Verify both customers exist.
      const [keepCustomer, removeCustomer] = await Promise.all([
        storage.getCustomer(keepId),
        storage.getCustomer(removeId),
      ]);
      if (!keepCustomer) return res.status(404).json({ error: "Customer to keep not found" });
      if (!removeCustomer) return res.status(404).json({ error: "Customer to remove not found" });

      const counts = await storage.mergeCustomers(keepId, removeId);
      res.json({ ok: true, survivingId: keepId, historyId: counts.historyId, ...counts });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      console.error("Manual merge error:", error);
      res.status(500).json({ error: "Failed to merge customers" });
    }
  });

  // Get single customer with full profile
  app.get("/api/admin/customers/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      // Fetch all linked records in parallel (also fetch records that were moved away from this customer)
      const [notes, leadsRows, quotesRows, convosRows, followUpsRows, externalLeadsRows, externalQuotesRows, externalConvosRows, artworkProofsRows, artworkMessagesRows, powerUpgradeRows] = await Promise.all([
        storage.getCustomerNotes(id),
        pool.query(`SELECT *, reassignment_history FROM leads WHERE customer_id = $1 ORDER BY created_at DESC`, [id]),
        pool.query(`SELECT id, user_name, email, phone, company, status, status_changed_at, est_total, created_at, admin_notes_history, previous_customer_name, previous_customer_id, reassigned_at, reassignment_history, wrapgen_preview_url, wrapgen_preview_id, wrapgen_proof_sent_at, artwork_approved_at, artwork_approved_by, selected_upgrade_ids FROM quotes WHERE customer_id = $1 ORDER BY created_at DESC`, [id]),
        pool.query(`SELECT id, session_id, status, contact_name, contact_phone, marked_contacted, contacted_note, created_at, completed_at, previous_customer_name, previous_customer_id, reassigned_at, reassignment_history FROM ai_conversations WHERE customer_id = $1 ORDER BY created_at DESC`, [id]),
        pool.query(`SELECT * FROM follow_ups WHERE lead_id IN (SELECT id FROM leads WHERE customer_id = $1) OR quote_id IN (SELECT id FROM quotes WHERE customer_id = $1) ORDER BY scheduled_date ASC`, [id]),
        // Records NOT currently owned by this customer but with any history entry mentioning them
        pool.query(`SELECT l.id, l.reassignment_history FROM leads l WHERE l.customer_id != $1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(l.reassignment_history) h WHERE h->>'fromCustomerId' = $1 OR h->>'toCustomerId' = $1)`, [id]),
        pool.query(`SELECT q.id, q.reassignment_history FROM quotes q WHERE q.customer_id != $1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(q.reassignment_history) h WHERE h->>'fromCustomerId' = $1 OR h->>'toCustomerId' = $1)`, [id]),
        pool.query(`SELECT a.id, a.reassignment_history FROM ai_conversations a WHERE a.customer_id != $1 AND EXISTS (SELECT 1 FROM jsonb_array_elements(a.reassignment_history) h WHERE h->>'fromCustomerId' = $1 OR h->>'toCustomerId' = $1)`, [id]),
        pool.query(`SELECT id, created_at, sent_at, responded_at, status, files, admin_notes FROM artwork_proofs WHERE customer_id = $1 ORDER BY created_at ASC`, [id]),
        pool.query(`SELECT apm.id, apm.proof_id, apm.sender_type, apm.sender_name, apm.message, apm.created_at FROM artwork_proof_messages apm JOIN artwork_proofs ap ON ap.id = apm.proof_id WHERE ap.customer_id = $1 ORDER BY apm.created_at ASC`, [id]),
        // 48V power-system upgrade ids: the "Silent Compressor Upgrade – Advanced 48V Power System"
        // exists under several upgrade records. Match by the known 48V SKUs or by name (the
        // published no-SKU duplicate is caught by the name pattern "48V Power System").
        pool.query(`SELECT id FROM upgrades WHERE sku IN ('MTV-U044','MTV-U021','MTV-U072') OR name ILIKE '%48V Power System%'`),
      ]);

      const leads = leadsRows.rows;
      const quotes = quotesRows.rows;
      const convos = convosRows.rows;
      const artworkProofs = artworkProofsRows.rows;
      const artworkMessages = artworkMessagesRows.rows;
      const followUps = followUpsRows.rows;
      const externalLeads = externalLeadsRows.rows;
      const externalQuotes = externalQuotesRows.rows;
      const externalConvos = externalConvosRows.rows;

      // Build unified activity timeline
      type TimelineEvent = {
        id: string;
        type: string;
        title: string;
        description?: string;
        author?: string;
        timestamp: string;
        entityId?: string;
        entityType?: string;
        relatedCustomerId?: string;
        relatedCustomerName?: string;
      };

      const timeline: TimelineEvent[] = [];

      // Lead events: creation, status changes, CRM notes
      for (const lead of leads) {
        timeline.push({
          id: `lead-created-${lead.id}`,
          type: "lead_created",
          title: `Lead submitted via ${(lead.source ?? "unknown").replace(/_/g, " ")}`,
          description: lead.message,
          timestamp: lead.created_at,
          entityId: lead.id,
          entityType: "lead",
        });

        // Status-change event (shown when status is not the default "new", using the timestamp stored)
        if (lead.status && lead.status !== "new" && lead.status_changed_at) {
          timeline.push({
            id: `lead-status-${lead.id}`,
            type: "lead_status_changed",
            title: `Lead status changed to ${(lead.status).replace(/_/g, " ")}`,
            timestamp: lead.status_changed_at,
            entityId: lead.id,
            entityType: "lead",
          });
        }

        // CRM notes on lead
        const crmNotes = lead.crm_notes ?? [];
        for (const note of crmNotes) {
          timeline.push({
            id: `lead-note-${lead.id}-${note.timestamp}`,
            type: "note",
            title: `Note on lead`,
            description: note.text,
            author: note.author,
            timestamp: note.timestamp,
            entityId: lead.id,
            entityType: "lead",
          });
        }
      }

      // Quote events
      for (const quote of quotes) {
        timeline.push({
          id: `quote-created-${quote.id}`,
          type: "quote_created",
          title: `Quote created`,
          description: `Status: ${(quote.status ?? "new").replace(/_/g, " ")} — £${Math.round((quote.est_total ?? 0) / 100).toLocaleString()}`,
          timestamp: quote.created_at,
          entityId: quote.id,
          entityType: "quote",
        });
        if (quote.status_changed_at && quote.status !== "new") {
          timeline.push({
            id: `quote-status-${quote.id}`,
            type: "quote_status",
            title: `Quote moved to ${(quote.status ?? "").replace(/_/g, " ")}`,
            timestamp: quote.status_changed_at,
            entityId: quote.id,
            entityType: "quote",
          });
        }
        const adminNotes = quote.admin_notes_history ?? [];
        for (const note of adminNotes) {
          timeline.push({
            id: `quote-note-${quote.id}-${note.timestamp}`,
            type: "note",
            title: `Note on quote`,
            description: note.text,
            author: note.author,
            timestamp: note.timestamp,
            entityId: quote.id,
            entityType: "quote",
          });
        }
      }

      // AI Conversation events
      for (const convo of convos) {
        timeline.push({
          id: `convo-started-${convo.id}`,
          type: "chat_started",
          title: `AI chat started`,
          description: convo.contact_phone ? `Phone: ${convo.contact_phone}` : undefined,
          timestamp: convo.created_at,
          entityId: convo.id,
          entityType: "conversation",
        });
        if (convo.completed_at) {
          timeline.push({
            id: `convo-completed-${convo.id}`,
            type: "chat_completed",
            title: `AI chat completed`,
            timestamp: convo.completed_at,
            entityId: convo.id,
            entityType: "conversation",
          });
        }
        if (convo.contacted_note) {
          timeline.push({
            id: `convo-note-${convo.id}`,
            type: "note",
            title: "Note from AI conversation",
            description: convo.contacted_note,
            timestamp: convo.completed_at ?? convo.created_at,
            entityId: convo.id,
            entityType: "conversation",
          });
        }
      }

      // Customer notes (direct)
      for (const note of notes) {
        timeline.push({
          id: `customer-note-${note.id}`,
          type: "customer_note",
          title: `${(note.noteType ?? "general").charAt(0).toUpperCase() + (note.noteType ?? "general").slice(1)} note`,
          description: note.text,
          author: note.authorName ?? undefined,
          timestamp: note.createdAt?.toISOString() ?? new Date().toISOString(),
          entityId: note.id,
          entityType: "customer_note",
        });
      }

      // Follow-up events
      for (const fu of followUps) {
        timeline.push({
          id: `followup-sched-${fu.id}`,
          type: "followup_scheduled",
          title: `Follow-up scheduled for ${fu.scheduled_date}`,
          description: fu.notes,
          author: fu.assigned_to_name,
          timestamp: fu.created_at,
          entityId: fu.id,
          entityType: "follow_up",
        });
        if (fu.completed && fu.completed_at) {
          timeline.push({
            id: `followup-done-${fu.id}`,
            type: "followup_completed",
            title: `Follow-up completed`,
            author: fu.assigned_to_name,
            timestamp: fu.completed_at,
            entityId: fu.id,
            entityType: "follow_up",
          });
        }
      }

      // Helper: emit timeline events from a reassignment_history array for a given record
      const emitHistoryEvents = (
        history: Array<{ fromCustomerName: string; fromCustomerId: string; toCustomerName: string; toCustomerId: string; reassignedAt: string }>,
        recordId: string,
        entityType: string,
        entityLabel: string,
      ) => {
        for (const entry of history) {
          if (entry.toCustomerId === id) {
            timeline.push({
              id: `${entityType}-reassigned-in-${recordId}-${entry.reassignedAt}`,
              type: "record_reassigned_in",
              title: `${entityLabel} moved from ${entry.fromCustomerName}`,
              timestamp: entry.reassignedAt,
              entityId: recordId,
              entityType,
              relatedCustomerName: entry.fromCustomerName,
            });
          } else if (entry.fromCustomerId === id) {
            timeline.push({
              id: `${entityType}-reassigned-out-${recordId}-${entry.reassignedAt}`,
              type: "record_reassigned_out",
              title: `${entityLabel} moved to ${entry.toCustomerName}`,
              timestamp: entry.reassignedAt,
              entityId: recordId,
              entityType,
              relatedCustomerName: entry.toCustomerName,
            });
          }
        }
      };

      // Reassignment events from currently-owned records
      for (const lead of leads) {
        const history = lead.reassignment_history ?? [];
        if (history.length > 0) {
          emitHistoryEvents(history, lead.id, "lead", "Lead");
        } else if (lead.previous_customer_name && lead.reassigned_at) {
          // Fallback for records that predate the history column and weren't backfilled
          timeline.push({
            id: `lead-reassigned-in-${lead.id}-${lead.reassigned_at}`,
            type: "record_reassigned_in",
            title: `Lead moved from ${lead.previous_customer_name}`,
            timestamp: lead.reassigned_at,
            entityId: lead.id,
            entityType: "lead",
            relatedCustomerId: lead.previous_customer_id,
            relatedCustomerName: lead.previous_customer_name,
          });
        }
      }
      for (const quote of quotes) {
        const history = quote.reassignment_history ?? [];
        if (history.length > 0) {
          emitHistoryEvents(history, quote.id, "quote", "Quote");
        } else if (quote.previous_customer_name && quote.reassigned_at) {
          timeline.push({
            id: `quote-reassigned-in-${quote.id}-${quote.reassigned_at}`,
            type: "record_reassigned_in",
            title: `Quote moved from ${quote.previous_customer_name}`,
            timestamp: quote.reassigned_at,
            entityId: quote.id,
            entityType: "quote",
            relatedCustomerId: quote.previous_customer_id,
            relatedCustomerName: quote.previous_customer_name,
          });
        }
      }
      for (const convo of convos) {
        const history = convo.reassignment_history ?? [];
        if (history.length > 0) {
          emitHistoryEvents(history, convo.id, "conversation", "AI chat");
        } else if (convo.previous_customer_name && convo.reassigned_at) {
          timeline.push({
            id: `convo-reassigned-in-${convo.id}-${convo.reassigned_at}`,
            type: "record_reassigned_in",
            title: `AI chat moved from ${convo.previous_customer_name}`,
            timestamp: convo.reassigned_at,
            entityId: convo.id,
            entityType: "conversation",
            relatedCustomerId: convo.previous_customer_id,
            relatedCustomerName: convo.previous_customer_name,
          });
        }
      }

      // Reassignment events from records no longer owned by this customer
      for (const lead of externalLeads) {
        emitHistoryEvents(lead.reassignment_history ?? [], lead.id, "lead", "Lead");
      }
      for (const quote of externalQuotes) {
        emitHistoryEvents(quote.reassignment_history ?? [], quote.id, "quote", "Quote");
      }
      for (const convo of externalConvos) {
        emitHistoryEvents(convo.reassignment_history ?? [], convo.id, "conversation", "AI chat");
      }

      // Artwork proof events
      for (const proof of artworkProofs) {
        const fileCount = Array.isArray(proof.files) ? proof.files.length : (JSON.parse(proof.files ?? '[]')).length;
        timeline.push({
          id: `artwork-created-${proof.id}`,
          type: "artwork_proof_created",
          title: `Artwork proof uploaded (${fileCount} file${fileCount !== 1 ? 's' : ''})`,
          timestamp: proof.created_at,
          entityId: proof.id,
          entityType: "artwork_proof",
        });
        if (proof.sent_at) {
          timeline.push({
            id: `artwork-sent-${proof.id}`,
            type: "artwork_proof_sent",
            title: `Artwork proof emailed to customer`,
            timestamp: proof.sent_at,
            entityId: proof.id,
            entityType: "artwork_proof",
          });
        }
        if (proof.responded_at && proof.status === 'approved') {
          timeline.push({
            id: `artwork-approved-${proof.id}`,
            type: "artwork_proof_approved",
            title: `Customer approved artwork`,
            timestamp: proof.responded_at,
            entityId: proof.id,
            entityType: "artwork_proof",
          });
        }
        if (proof.responded_at && proof.status === 'changes_requested') {
          timeline.push({
            id: `artwork-changes-${proof.id}`,
            type: "artwork_proof_changes",
            title: `Customer requested artwork changes`,
            timestamp: proof.responded_at,
            entityId: proof.id,
            entityType: "artwork_proof",
          });
        }
      }

      // Artwork proof messages (discussion thread)
      for (const msg of artworkMessages) {
        const isAdmin = msg.sender_type === 'admin';
        timeline.push({
          id: `artwork-msg-${msg.id}`,
          type: isAdmin ? "artwork_message_admin" : "artwork_message_customer",
          title: isAdmin ? `${msg.sender_name} sent a message` : `Customer replied`,
          description: msg.message,
          author: msg.sender_name,
          timestamp: msg.created_at,
          entityId: msg.proof_id,
          entityType: "artwork_proof",
        });
      }

      // Sort timeline newest-first
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Build handoff card data
      const lastNote = timeline.find(e => e.type === "note" || e.type === "customer_note");
      const openFollowUps = followUps.filter((f: any) => !f.completed);
      const latestLead = leads[0];
      const latestQuote = quotes[0];

      // Resolve assigned staff name
      let primaryStaffName: string | null = null;
      if (customer.primaryStaffId) {
        const staffUser = await storage.getUser(customer.primaryStaffId);
        if (staffUser) {
          primaryStaffName =
            staffUser.firstName && staffUser.lastName
              ? `${staffUser.firstName} ${staffUser.lastName}`
              : staffUser.username;
        }
      }

      // 48V eligibility: any linked quote whose configuration includes the
      // "Silent Compressor Upgrade – Advanced 48V Power System" upgrade. That
      // upgrade exists under several UUID ids in production (matched above by
      // name); the legacy "silent-compressor-upgrade" slug is kept as a fallback.
      const fortyEightVIds = new Set<string>([
        "silent-compressor-upgrade",
        ...powerUpgradeRows.rows.map((r: any) => r.id),
      ]);
      const is48v = quotes.some((q: any) =>
        Array.isArray(q.selected_upgrade_ids) &&
        q.selected_upgrade_ids.some((u: string) => fortyEightVIds.has(u))
      );

      res.json({
        customer: { ...customer, primaryStaffName },
        is48v,
        leads,
        quotes,
        conversations: convos,
        followUps,
        notes,
        timeline,
        handoff: {
          currentStatus: latestQuote?.status ?? latestLead?.status ?? "unknown",
          lastContactAt: timeline[0]?.timestamp ?? null,
          lastNote: lastNote ? { text: lastNote.description, author: lastNote.author, timestamp: lastNote.timestamp } : null,
          openFollowUps: openFollowUps.map((f: any) => ({
            id: f.id,
            scheduledDate: f.scheduled_date,
            notes: f.notes,
            assignedToName: f.assigned_to_name,
          })),
        },
      });
    } catch (error) {
      console.error("Get customer error:", error);
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  // Create customer
  app.post("/api/admin/customers", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const schema_z = z.object({
        name: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        company: z.string().optional(),
      });
      const data = schema_z.parse(req.body);
      const customer = await storage.createCustomer({
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        company: data.company || undefined,
      });

      // Backfill any existing unlinked leads/quotes that match by email or phone
      storage.backfillLeadsAndQuotesForCustomer(customer.id, customer.email, customer.phone)
        .catch(err => console.error("Customer backfill (create) error:", err?.message));

      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      console.error("Create customer error:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  // Update customer contact details
  app.patch("/api/admin/customers/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const schema_z = z.object({
        name: z.string().min(1).optional(),
        email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
        phone: z.string().optional().nullable(),
        company: z.string().optional().nullable(),
        primaryStaffId: z.string().optional().nullable(),
        vrmInstallationId: z.string().trim().regex(/^\d*$/, "VRM Installation ID must be numeric").optional().nullable(),
      });
      const data = schema_z.parse(req.body);

      // Validate that the assigned staff member exists and has an admin role
      if (data.primaryStaffId) {
        const staffUser = await storage.getUser(data.primaryStaffId);
        if (!staffUser || !staffUser.adminRole || staffUser.adminRole === "none") {
          return res.status(400).json({ error: "Invalid staff member: user does not exist or is not a staff member" });
        }
      }

      const customer = await storage.updateCustomer(id, data);
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      // If email or phone was updated, backfill any unlinked leads/quotes matching the new values
      if (data.email !== undefined || data.phone !== undefined) {
        storage.backfillLeadsAndQuotesForCustomer(customer.id, customer.email, customer.phone)
          .catch(err => console.error("Customer backfill (update) error:", err?.message));
      }

      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      console.error("Update customer error:", error);
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // Live Victron VRM power data for a customer's installation (48V power-system monitoring).
  // Proxied server-side so the VRM access token is never exposed to the browser.
  app.get("/api/admin/customers/:id/vrm", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const token = process.env.VRM_API_TOKEN;
      if (!token) {
        return res.status(503).json({ error: "VRM access token is not configured. Add the VRM_API_TOKEN secret to enable live power data." });
      }

      const customer = await storage.getCustomer(id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const installationId = (customer.vrmInstallationId || "").trim();
      if (!installationId) {
        return res.status(400).json({ error: "No VRM Installation ID set for this customer." });
      }
      if (!/^\d+$/.test(installationId)) {
        return res.status(400).json({ error: "VRM Installation ID must be numeric." });
      }

      const vrmUrl = `https://vrmapi.victronenergy.com/v2/installations/${encodeURIComponent(installationId)}/diagnostics?count=100`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let vrmRes: Response;
      try {
        vrmRes = await fetch(vrmUrl, {
          headers: { "x-authorization": `Token ${token}`, "Accept": "application/json" },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (vrmRes.status === 401 || vrmRes.status === 403) {
        return res.status(502).json({ error: "VRM rejected the access token. Check the VRM_API_TOKEN secret." });
      }
      if (vrmRes.status === 429) {
        return res.status(429).json({ error: "VRM is rate limiting requests. Please try again in a moment." });
      }
      if (!vrmRes.ok) {
        return res.status(502).json({ error: `VRM request failed (status ${vrmRes.status}).` });
      }

      const payload: any = await vrmRes.json();
      if (payload?.success === false) {
        return res.status(502).json({ error: payload?.errors ? JSON.stringify(payload.errors) : "VRM returned an error." });
      }

      const records: any[] = Array.isArray(payload?.records) ? payload.records : [];
      const metrics = records.map((r: any) => ({
        code: r.code ?? null,
        label: r.description ?? r.customLabel ?? r.code ?? "",
        value: r.formattedValue ?? (r.formatValueOnly ?? (r.rawValue ?? r.valueFloat ?? r.valueString ?? null)),
        timestamp: r.timestamp ?? null,
      })).filter((m: any) => m.value !== null && m.value !== "");

      // Build a clean, dashboard-ready view that mirrors the Victron VRM dashboard
      // (Grid / AC Loads / Battery / Charging / DC Power tiles + system state).
      // VRM diagnostics can contain the same `code` on multiple devices/instances,
      // so we prefer a specific source device per metric and fall back to a
      // code-only match if that device is absent. Device naming is matched
      // resiliently across the field variations VRM has used.
      const deviceName = (r: any): string =>
        String(r?.Device ?? r?.device ?? r?.deviceName ?? "");
      const toRaw = (rec: any) =>
        typeof rec.rawValue === "number"
          ? rec.rawValue
          : typeof rec.valueFloat === "number"
            ? rec.valueFloat
            : null;
      const pick = (code: string, preferredDevice?: string) => {
        let rec: any = undefined;
        if (preferredDevice) {
          rec = records.find((r: any) => r.code === code && deviceName(r) === preferredDevice);
        }
        if (!rec) rec = records.find((r: any) => r.code === code);
        if (!rec) return null;
        return { value: rec.formattedValue ?? null, raw: toRaw(rec), timestamp: rec.timestamp ?? null };
      };

      const gridPower = pick("IP1", "VE.Bus System");
      const gridVoltage = pick("IV1", "VE.Bus System");
      const gridCurrent = pick("II1", "VE.Bus System");
      const gridFrequency = pick("IF1", "VE.Bus System");
      const acLoad = pick("a1", "System overview") || pick("o1", "System overview");
      const acFrequency = pick("OF", "VE.Bus System");
      const soc = pick("SOC", "Battery Monitor");
      const battVoltage =
        pick("bv", "System overview") || pick("CV", "VE.Bus System") || pick("V", "Battery Monitor");
      const battCurrent =
        pick("bc", "System overview") || pick("CI", "VE.Bus System") || pick("I", "Battery Monitor");
      const battTemp = pick("tsT", "Temperature sensor");
      const dcSystem = pick("dc", "System overview");
      const systemState = pick("ss", "System overview") || pick("S", "VE.Bus System");

      const fmtW = (n: number | null | undefined) =>
        n === null || n === undefined ? null : `${Math.round(n)} W`;
      const battPower =
        battVoltage?.raw != null && battCurrent?.raw != null
          ? fmtW(battVoltage.raw * battCurrent.raw)
          : null;
      const dcCurrent =
        dcSystem?.raw != null && battVoltage?.raw
          ? `${(dcSystem.raw / battVoltage.raw).toFixed(1)} A`
          : null;

      const latestTimestamp = records.reduce(
        (acc: number | null, r: any) =>
          typeof r.timestamp === "number" && (acc === null || r.timestamp > acc) ? r.timestamp : acc,
        null as number | null,
      );

      const dashboard = {
        systemState: systemState?.value ?? null,
        grid: {
          power: gridPower?.value ?? null,
          voltage: gridVoltage?.value ?? null,
          current: gridCurrent?.value ?? null,
          frequency: gridFrequency?.value ?? null,
        },
        acLoads: {
          power: acLoad?.value ?? null,
          frequency: acFrequency?.value ?? null,
        },
        battery: {
          temperature: battTemp?.value ?? null,
          soc: soc?.value ?? null,
          voltage: battVoltage?.value ?? null,
          current: battCurrent?.value ?? null,
          power: battPower,
        },
        dcPower: {
          power: dcSystem?.value ?? null,
          voltage: battVoltage?.value ?? null,
          current: dcCurrent,
        },
      };

      res.json({
        installationId,
        dashboardUrl: `https://vrm.victronenergy.com/installation/${encodeURIComponent(installationId)}/dashboard`,
        updatedAt: latestTimestamp,
        dashboard,
        metrics,
      });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return res.status(504).json({ error: "VRM request timed out." });
      }
      console.error("VRM fetch error:", error?.message);
      res.status(500).json({ error: "Failed to fetch VRM power data." });
    }
  });

  // Delete a customer profile (full admin only) — unlinks related records, removes notes, then deletes profile
  app.delete("/api/admin/customers/:id", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      await storage.deleteCustomer(id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Delete customer error:", error);
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // Add a note to a customer (also appends to linked lead/quote if applicable)
  app.post("/api/admin/customers/:id/notes", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const schema_z = z.object({
        noteType: z.enum(["call", "email", "meeting", "general"]).default("general"),
        text: z.string().min(1),
      });
      const data = schema_z.parse(req.body);
      const authorName = req.session.user?.username ?? "Admin";
      const authorId = req.session.user?.id ?? null;
      const timestamp = new Date().toISOString();
      const noteEntry = { text: data.text, timestamp, author: authorName };

      // Create customer note
      const note = await storage.createCustomerNote({
        customerId: id,
        authorId,
        authorName,
        noteType: data.noteType,
        text: data.text,
      });

      // Automatically propagate to ALL linked leads and quotes for this customer
      const [linkedLeads, linkedQuotes] = await Promise.all([
        pool.query(`SELECT id, crm_notes FROM leads WHERE customer_id = $1`, [id]),
        pool.query(`SELECT id, admin_notes_history FROM quotes WHERE customer_id = $1`, [id]),
      ]);

      await Promise.all([
        ...linkedLeads.rows.map((lead: any) => {
          const existing: Array<{ text: string; timestamp: string; author?: string }> = lead.crm_notes ?? [];
          return storage.updateLead(lead.id, { crmNotes: [...existing, noteEntry] });
        }),
        ...linkedQuotes.rows.map((quote: any) => {
          const existing: Array<{ text: string; timestamp: string; author?: string }> = quote.admin_notes_history ?? [];
          return storage.updateQuote(quote.id, { adminNotesHistory: [...existing, noteEntry] });
        }),
      ]);

      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      console.error("Create customer note error:", error);
      res.status(500).json({ error: "Failed to add note" });
    }
  });

  // Deduplicate: find customers sharing the same email or phone and merge them.
  // Runs the same email-first, phone-fallback merge logic that findOrCreateCustomer now uses,
  // applied to all existing customer pairs so historical duplicates are cleaned up.
  app.post("/api/admin/customers/deduplicate", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const triggeredByUserId: string | undefined = (req.session as any)?.user?.id ?? undefined;
      let mergedCount = 0;
      const errors: string[] = [];
      // Track surviving customers and how many duplicates each absorbed
      const mergedCustomerMap = new Map<string, { id: string; name: string; duplicatesAbsorbed: number; leadsRepointed: number; quotesRepointed: number; convosRepointed: number }>();

      async function fetchCustomerName(id: string): Promise<string> {
        const r = await pool.query<{ name: string }>(`SELECT name FROM customers WHERE id = $1 LIMIT 1`, [id]);
        return r.rows[0]?.name ?? "Unknown";
      }

      function recordMerge(keepId: string, keepName: string, counts: { leadsRepointed: number; quotesRepointed: number; convosRepointed: number }) {
        const existing = mergedCustomerMap.get(keepId);
        if (existing) {
          existing.duplicatesAbsorbed++;
          existing.leadsRepointed += counts.leadsRepointed;
          existing.quotesRepointed += counts.quotesRepointed;
          existing.convosRepointed += counts.convosRepointed;
        } else {
          mergedCustomerMap.set(keepId, { id: keepId, name: keepName, duplicatesAbsorbed: 1, ...counts });
        }
      }

      // --- Step 1: Merge customers that share the same non-null email ---
      const dupEmails = await pool.query<{ email: string }>(`
        SELECT email
        FROM customers
        WHERE email IS NOT NULL AND email != '' AND deleted_at IS NULL
        GROUP BY email
        HAVING COUNT(*) > 1
      `);

      for (const { email } of dupEmails.rows) {
        try {
          // Fetch all active customers with this email, oldest first (keep the oldest).
          const { rows } = await pool.query<{ id: string; name: string }>(
            `SELECT id, name FROM customers WHERE email = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
            [email]
          );
          const [keep, ...duplicates] = rows;
          for (const dup of duplicates) {
            const counts = await storage.mergeCustomers(keep.id, dup.id, triggeredByUserId);
            mergedCount++;
            recordMerge(keep.id, keep.name ?? "Unknown", counts);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Dedup error (email=${email}):`, msg);
          errors.push(`email:${email}`);
        }
      }

      // --- Step 2: Merge customers that share the same non-null phone ---
      // (After email dedup some phone dupes may already be resolved.)
      const dupPhones = await pool.query<{ phone: string }>(`
        SELECT phone
        FROM customers
        WHERE phone IS NOT NULL AND phone != '' AND deleted_at IS NULL
        GROUP BY phone
        HAVING COUNT(*) > 1
      `);

      for (const { phone } of dupPhones.rows) {
        try {
          const { rows } = await pool.query<{ id: string; name: string }>(
            `SELECT id, name FROM customers WHERE phone = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
            [phone]
          );
          const [keep, ...duplicates] = rows;
          for (const dup of duplicates) {
            const counts = await storage.mergeCustomers(keep.id, dup.id, triggeredByUserId);
            mergedCount++;
            recordMerge(keep.id, keep.name ?? "Unknown", counts);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Dedup error (phone=${phone}):`, msg);
          errors.push(`phone:${phone}`);
        }
      }

      // --- Step 3: Split-pair detection — same conversation/lead/quote, different customers ---
      // The classic historical scenario: save 1 had only phone → Customer A; save 2 had only
      // email → Customer B; completion linked Customer B. Customer A is orphaned.
      // Detect via: the linked customer has an email and the conversation also recorded a phone
      // that belongs to a DIFFERENT customer (and vice-versa).
      const splitPairs = await pool.query<{ keep_id: string; merge_id: string }>(`
        SELECT DISTINCT
          ac.customer_id AS keep_id,
          c2.id           AS merge_id
        FROM ai_conversations ac
        JOIN customers c1 ON c1.id = ac.customer_id AND c1.deleted_at IS NULL
        JOIN customers c2 ON c2.id != ac.customer_id AND c2.deleted_at IS NULL
        WHERE ac.customer_id IS NOT NULL
          AND (
            -- linked customer was matched by email; orphan was created by phone
            (
              c1.email IS NOT NULL AND c1.email != ''
              AND c2.phone IS NOT NULL AND c2.phone != ''
              AND c2.email IS NULL
              AND (
                ac.contact_phone = c2.phone
                OR (ac.mapped_config->>'contactPhone') = c2.phone
              )
            )
            OR
            -- linked customer was matched by phone; orphan was created by email
            (
              c1.phone IS NOT NULL AND c1.phone != ''
              AND c2.email IS NOT NULL AND c2.email != ''
              AND c2.phone IS NULL
              AND (
                (ac.mapped_config->>'contactEmail') = c2.email
              )
            )
          )
      `);

      for (const { keep_id, merge_id } of splitPairs.rows) {
        // Skip pairs that were already merged in steps 1 or 2.
        const stillExists = await pool.query(
          `SELECT id FROM customers WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
          [merge_id]
        );
        if (stillExists.rows.length === 0) continue;
        try {
          const keepName = mergedCustomerMap.get(keep_id)?.name ?? await fetchCustomerName(keep_id);
          const counts = await storage.mergeCustomers(keep_id, merge_id, triggeredByUserId);
          mergedCount++;
          recordMerge(keep_id, keepName, counts);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Dedup error (split-pair keep=${keep_id} merge=${merge_id}):`, msg);
          errors.push(`split-pair:${merge_id}`);
        }
      }

      // Now that duplicates are resolved, apply the unique partial indexes.
      // These guard against future duplicate inserts at the DB level.
      // Surface any failure in the response — a non-null indexError means
      // duplicates may still exist and the admin should investigate.
      let indexError: string | null = null;
      try {
        await pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique
            ON customers (email)
            WHERE email IS NOT NULL AND email != '';
          CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique
            ON customers (phone)
            WHERE phone IS NOT NULL AND phone != '';
        `);
        console.log("✅ Customer unique indexes confirmed after dedup");
      } catch (err: unknown) {
        indexError = err instanceof Error ? err.message : String(err);
        console.error("Unique index creation after dedup:", indexError);
      }

      const mergedCustomers = Array.from(mergedCustomerMap.values());
      res.json({ ok: true, mergedCount, failedCount: errors.length, errors, mergedCustomers, indexError });
    } catch (error) {
      console.error("Customer dedup error:", error);
      res.status(500).json({ error: "Deduplication failed" });
    }
  });

  // Backfill: link existing leads/quotes/ai_conversations without a customer_id to customer profiles
  app.post("/api/admin/customers/backfill", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      let leadsLinked = 0;
      let quotesLinked = 0;
      let convosLinked = 0;
      let customersCreated = 0;
      const errors: string[] = [];
      const linkedCustomerMap = new Map<string, { id: string; name: string; isNew: boolean; leadsLinked: number; quotesLinked: number; convosLinked: number }>();

      // Mirror findOrCreateCustomer's email-first, phone-fallback lookup to detect if customer already existed.
      async function findOrCreate(email: string | null, phone: string | null, name: string): Promise<{ id: string; isNew: boolean; name: string }> {
        let existing = email ? await storage.findCustomerByEmail(email) : undefined;
        if (!existing && phone) existing = await storage.findCustomerByPhone(phone);
        const customer = await storage.findOrCreateCustomer(email, phone, name);
        return { id: customer.id, isNew: !existing, name: customer.name ?? name };
      }

      function normalizeContact(val: unknown): string | null {
        const s = typeof val === "string" ? val.trim() : "";
        return s || null;
      }

      function ensureInMap(customerId: string, customerName: string, isNew: boolean) {
        if (!linkedCustomerMap.has(customerId)) {
          linkedCustomerMap.set(customerId, { id: customerId, name: customerName, isNew, leadsLinked: 0, quotesLinked: 0, convosLinked: 0 });
        }
      }

      // Backfill leads
      const leadsToLink = await pool.query(`
        SELECT id, name, email, phone FROM leads
        WHERE customer_id IS NULL AND (email IS NOT NULL OR phone IS NOT NULL)
      `);
      for (const row of leadsToLink.rows) {
        try {
          const email = normalizeContact(row.email);
          const phone = normalizeContact(row.phone);
          if (!email && !phone) continue;
          const { id: customerId, isNew, name: customerName } = await findOrCreate(email, phone, normalizeContact(row.name) ?? "Unknown");
          if (isNew) customersCreated++;
          ensureInMap(customerId, customerName, isNew);
          await storage.linkLeadToCustomer(row.id, customerId);
          leadsLinked++;
          linkedCustomerMap.get(customerId)!.leadsLinked++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Customer backfill — lead ${row.id} failed:`, msg);
          errors.push(`lead:${row.id}`);
        }
      }

      // Backfill quotes
      const quotesToLink = await pool.query(`
        SELECT id, user_name, email, phone FROM quotes
        WHERE customer_id IS NULL AND (email IS NOT NULL OR phone IS NOT NULL)
      `);
      for (const row of quotesToLink.rows) {
        try {
          const email = normalizeContact(row.email);
          const phone = normalizeContact(row.phone);
          if (!email && !phone) continue;
          const { id: customerId, isNew, name: customerName } = await findOrCreate(email, phone, normalizeContact(row.user_name) ?? "Unknown");
          if (isNew) customersCreated++;
          ensureInMap(customerId, customerName, isNew);
          await storage.linkQuoteToCustomer(row.id, customerId);
          quotesLinked++;
          linkedCustomerMap.get(customerId)!.quotesLinked++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Customer backfill — quote ${row.id} failed:`, msg);
          errors.push(`quote:${row.id}`);
        }
      }

      // Backfill ai_conversations — derive contact from mapped_config (email/phone/name)
      // and top-level contact_name / contact_phone columns (phone captured in real time).
      const convosToLink = await pool.query(`
        SELECT id, session_id, mapped_config, contact_name, contact_phone FROM ai_conversations
        WHERE customer_id IS NULL
          AND (contact_phone IS NOT NULL OR mapped_config IS NOT NULL)
      `);
      for (const row of convosToLink.rows) {
        try {
          const cfg = typeof row.mapped_config === "string" ? JSON.parse(row.mapped_config) : (row.mapped_config ?? {});
          // Email only comes from mapped_config; phone and name fall back to top-level columns
          const email = normalizeContact(cfg.contactEmail);
          const phone = normalizeContact(cfg.contactPhone) ?? normalizeContact(row.contact_phone);
          const name = normalizeContact(cfg.contactName) ?? normalizeContact(row.contact_name) ?? "AI Chat Contact";
          if (!email && !phone) continue;
          const { id: customerId, isNew, name: customerName } = await findOrCreate(email, phone, name);
          if (isNew) customersCreated++;
          ensureInMap(customerId, customerName, isNew);
          await storage.linkConversationToCustomer(row.id, customerId);
          convosLinked++;
          linkedCustomerMap.get(customerId)!.convosLinked++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Customer backfill — conversation ${row.id} failed:`, msg);
          errors.push(`conversation:${row.id}`);
        }
      }

      const linkedCustomers = Array.from(linkedCustomerMap.values());
      res.json({ ok: true, customersCreated, leadsLinked, quotesLinked, convosLinked, failedCount: errors.length, linkedCustomers });
    } catch (error) {
      console.error("Customer backfill error:", error);
      res.status(500).json({ error: "Backfill failed" });
    }
  });

  // Reassign a linked record (lead / quote / conversation) to a different customer
  app.patch("/api/admin/records/:type/:id/reassign", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { type, id } = req.params;
      if (!["lead", "quote", "conversation"].includes(type)) {
        return res.status(400).json({ error: "Invalid record type. Must be lead, quote, or conversation." });
      }

      const schema_z = z.object({ targetCustomerId: z.string().min(1) });
      const { targetCustomerId } = schema_z.parse(req.body);

      const targetCustomer = await storage.getCustomer(targetCustomerId);
      if (!targetCustomer) return res.status(404).json({ error: "Target customer not found" });

      const currentUser = await getCurrentUser(req);
      const actorDbUser = currentUser ? await storage.getUser(currentUser.id) : null;
      const staffName = actorDbUser
        ? ([actorDbUser.firstName, actorDbUser.lastName].filter(Boolean).join(" ").trim() || actorDbUser.username)
        : undefined;

      if (type === "lead") {
        await storage.linkLeadToCustomer(id, targetCustomerId, staffName);
      } else if (type === "quote") {
        await storage.linkQuoteToCustomer(id, targetCustomerId, staffName);
      } else {
        await storage.linkConversationToCustomer(id, targetCustomerId, staffName);
      }

      res.json({ ok: true, targetCustomerId });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      console.error("Reassign record error:", error);
      res.status(500).json({ error: "Failed to reassign record" });
    }
  });

  // ── Artwork Proofs ──────────────────────────────────────────────────────────

  // Get a presigned PUT URL for an artwork proof image (client-side direct upload via ObjectUploader)
  app.post("/api/admin/artwork-proofs/upload-url", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { filename, contentType } = req.body;
      if (!filename || !contentType) {
        return res.status(400).json({ error: "filename and contentType are required" });
      }
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(contentType.toLowerCase())) {
        return res.status(400).json({ error: "Only PNG and JPEG files are allowed" });
      }
      const { ObjectStorageService } = await import("./objectStorage");
      const svc = new ObjectStorageService();
      const { uploadURL, publicURL } = await svc.getArtworkProofUploadURL(filename);
      res.json({ uploadURL, objectPath: publicURL });
    } catch (error) {
      console.error("Artwork proof upload-url error:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Normalise a stored artwork file URL to a backend-proxied /objects/<path> URL.
  // Handles full GCS URLs (https://storage.googleapis.com/<bucket>/<objectName>)
  // and already-normalised /objects/... paths.
  function normalizeArtworkFileUrl(url: string): string {
    if (!url) return url;
    // Already a proxy path — check if it has a stray public/ prefix and strip it
    if (url.startsWith('/objects/public/artwork-proofs/')) {
      return url.replace('/objects/public/artwork-proofs/', '/objects/artwork-proofs/');
    }
    if (url.startsWith('/objects/')) return url;
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'storage.googleapis.com') {
        // pathname is /<bucket>/<objectPath>  e.g. /bucket/public/artwork-proofs/uuid-file.jpg
        // Strip bucket + any leading public/ prefix so entityId = artwork-proofs/<file>
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          // parts[0] = bucket name — drop it
          const afterBucket = parts.slice(1).join('/');
          // Drop a leading "public/" segment if present (added by the storage service)
          const objectName = afterBucket.startsWith('public/')
            ? afterBucket.slice('public/'.length)
            : afterBucket;
          return `/objects/${objectName}`;
        }
      }
    } catch {}
    return url;
  }

  // List artwork proofs for a customer
  app.get("/api/admin/customers/:id/artwork-proofs", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { rows } = await pool.query(
        `SELECT ap.*, u.username AS uploaded_by_name,
                COALESCE(u.first_name || ' ' || u.last_name, u.username) AS uploaded_by_display
         FROM artwork_proofs ap
         LEFT JOIN users u ON u.id = ap.uploaded_by_id
         WHERE ap.customer_id = $1
         ORDER BY ap.created_at DESC`,
        [id]
      );
      res.json(rows.map((r: any) => {
        const rawFiles: Array<{ url: string; name: string }> =
          Array.isArray(r.files) ? r.files : (typeof r.files === 'string' ? JSON.parse(r.files) : []);
        return {
          id: r.id,
          customerId: r.customer_id,
          quoteId: r.quote_id,
          uploadedById: r.uploaded_by_id,
          uploadedByName: r.uploaded_by_display?.trim() || r.uploaded_by_name || null,
          files: rawFiles.map(f => ({ ...f, url: normalizeArtworkFileUrl(f.url) })),
          status: r.status,
          token: r.token,
          adminNotes: r.admin_notes,
          customerNotes: r.customer_notes,
          sentAt: r.sent_at,
          respondedAt: r.responded_at,
          createdAt: r.created_at,
        };
      }));
    } catch (error) {
      console.error("List artwork proofs error:", error);
      res.status(500).json({ error: "Failed to fetch artwork proofs" });
    }
  });

  // Create a new artwork proof round
  app.post("/api/admin/customers/:id/artwork-proofs", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const customer = await storage.getCustomer(id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const schema = z.object({
        files: z.array(z.object({ url: z.string(), name: z.string() })).min(1),
        adminNotes: z.string().optional().nullable(),
        quoteId: z.string().optional().nullable(),
      });
      const { files, adminNotes, quoteId } = schema.parse(req.body);

      const currentUser = await getCurrentUser(req);
      const token = crypto.randomBytes(32).toString('hex');

      const { rows } = await pool.query(
        `INSERT INTO artwork_proofs (customer_id, quote_id, uploaded_by_id, files, status, token, admin_notes)
         VALUES ($1, $2, $3, $4, 'pending_review', $5, $6)
         RETURNING *`,
        [id, quoteId ?? null, currentUser?.id ?? null, JSON.stringify(files), token, adminNotes ?? null]
      );
      const proof = rows[0];
      res.json({
        id: proof.id,
        customerId: proof.customer_id,
        files: Array.isArray(proof.files) ? proof.files : JSON.parse(proof.files),
        status: proof.status,
        token: proof.token,
        adminNotes: proof.admin_notes,
        createdAt: proof.created_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      console.error("Create artwork proof error:", error);
      res.status(500).json({ error: "Failed to create artwork proof" });
    }
  });

  // Send artwork proof email to customer (any admin can send artwork proofs)
  app.post("/api/admin/artwork-proofs/:id/send", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { rows: proofRows } = await pool.query(`SELECT * FROM artwork_proofs WHERE id = $1`, [id]);
      if (proofRows.length === 0) return res.status(404).json({ error: "Artwork proof not found" });
      const proof = proofRows[0];

      const customer = await storage.getCustomer(proof.customer_id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      if (!customer.email) return res.status(400).json({ error: "Customer has no email address" });

      const rawFiles: Array<{ url: string; name: string }> = Array.isArray(proof.files) ? proof.files : JSON.parse(proof.files);

      const siteBase = process.env.SITE_URL ||
        (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}` : brandSiteUrl());

      // Generate presigned 7-day GET URLs so email clients can load the images
      // without needing authentication. GCS direct URLs require signed access.
      const { ObjectStorageService } = await import('./objectStorage.js');
      const svc = new ObjectStorageService();
      const emailFiles = await Promise.all(rawFiles.map(async (f) => {
        try {
          const signedUrl = await svc.getArtworkProofSignedReadUrl(f.url);
          return { ...f, url: signedUrl };
        } catch (err) {
          console.error("Failed to sign artwork URL for email:", f.url, err);
          // Fall back to whatever was stored — better than nothing
          return f;
        }
      }));

      const { sendArtworkProofEmail } = await import('./email.js');
      await sendArtworkProofEmail({
        to: customer.email,
        customerName: customer.name,
        proofId: proof.id,
        token: proof.token,
        files: emailFiles,
        adminNotes: proof.admin_notes,
        siteBaseUrl: siteBase,
      });

      await pool.query(`UPDATE artwork_proofs SET sent_at = NOW() WHERE id = $1`, [id]);
      res.json({ ok: true });
    } catch (error) {
      console.error("Send artwork proof email error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // ── Artwork proof messages ───────────────────────────────────────────────────

  // List messages for a proof (admin)
  app.get("/api/admin/artwork-proofs/:proofId/messages", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { proofId } = req.params;
      const { rows } = await pool.query(
        `SELECT id, proof_id, sender_type, sender_name, message, created_at FROM artwork_proof_messages WHERE proof_id = $1 ORDER BY created_at ASC`,
        [proofId]
      );
      res.json(rows.map(r => ({
        id: r.id, proofId: r.proof_id, senderType: r.sender_type,
        senderName: r.sender_name, message: r.message, createdAt: r.created_at,
      })));
    } catch (error) {
      console.error("List artwork messages error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Admin sends a message (notifies customer by email if they have one)
  app.post("/api/admin/artwork-proofs/:proofId/messages", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { proofId } = req.params;
      const { message } = z.object({ message: z.string().min(1).max(5000) }).parse(req.body);
      const senderName = (req.user as any)?.name || (req.user as any)?.username || "Graphics Team";

      const { rows: proofRows } = await pool.query(
        `SELECT ap.*, c.name AS customer_name, c.email AS customer_email
         FROM artwork_proofs ap JOIN customers c ON c.id = ap.customer_id
         WHERE ap.id = $1`,
        [proofId]
      );
      if (proofRows.length === 0) return res.status(404).json({ error: "Proof not found" });
      const proof = proofRows[0];

      const { rows: msgRows } = await pool.query(
        `INSERT INTO artwork_proof_messages (proof_id, sender_type, sender_name, message)
         VALUES ($1, 'admin', $2, $3)
         RETURNING id, proof_id, sender_type, sender_name, message, created_at`,
        [proofId, senderName, message]
      );
      const msg = msgRows[0];

      // Email the customer (non-fatal)
      if (proof.customer_email) {
        try {
          const { sendArtworkMessageToCustomer } = await import('./email.js');
          const siteBase = process.env.SITE_URL ||
            (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}` : brandSiteUrl());
          await sendArtworkMessageToCustomer({
            to: proof.customer_email,
            customerName: proof.customer_name,
            senderName,
            message,
            token: proof.token,
            siteBaseUrl: siteBase,
          });
        } catch { /* non-fatal */ }
      }

      res.json({
        id: msg.id, proofId: msg.proof_id, senderType: msg.sender_type,
        senderName: msg.sender_name, message: msg.message, createdAt: msg.created_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      console.error("Send artwork message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Public: list messages for a proof by token (customer view)
  app.get("/api/artwork-approval/:token/messages", async (req, res) => {
    try {
      const { token } = req.params;
      const { rows: proofRows } = await pool.query(
        `SELECT id FROM artwork_proofs WHERE token = $1`, [token]
      );
      if (proofRows.length === 0) return res.status(404).json({ error: "Not found" });
      const proofId = proofRows[0].id;
      const { rows } = await pool.query(
        `SELECT id, proof_id, sender_type, sender_name, message, created_at FROM artwork_proof_messages WHERE proof_id = $1 ORDER BY created_at ASC`,
        [proofId]
      );
      res.json(rows.map(r => ({
        id: r.id, proofId: r.proof_id, senderType: r.sender_type,
        senderName: r.sender_name, message: r.message, createdAt: r.created_at,
      })));
    } catch (error) {
      console.error("List artwork messages (customer) error:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Public: customer sends a message by token (notifies internal team)
  app.post("/api/artwork-approval/:token/messages", async (req, res) => {
    try {
      const { token } = req.params;
      const { message, senderName } = z.object({
        message: z.string().min(1).max(5000),
        senderName: z.string().min(1).max(200),
      }).parse(req.body);

      const { rows: proofRows } = await pool.query(
        `SELECT ap.*, c.name AS customer_name FROM artwork_proofs ap JOIN customers c ON c.id = ap.customer_id WHERE ap.token = $1`,
        [token]
      );
      if (proofRows.length === 0) return res.status(404).json({ error: "Not found" });
      const proof = proofRows[0];

      const { rows: msgRows } = await pool.query(
        `INSERT INTO artwork_proof_messages (proof_id, sender_type, sender_name, message)
         VALUES ($1, 'customer', $2, $3)
         RETURNING id, proof_id, sender_type, sender_name, message, created_at`,
        [proof.id, senderName, message]
      );
      const msg = msgRows[0];

      res.json({
        id: msg.id, proofId: msg.proof_id, senderType: msg.sender_type,
        senderName: msg.sender_name, message: msg.message, createdAt: msg.created_at,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      console.error("Customer artwork message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Update admin notes on an artwork proof
  app.patch("/api/admin/artwork-proofs/:id", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { adminNotes } = z.object({ adminNotes: z.string().nullable() }).parse(req.body);
      await pool.query(`UPDATE artwork_proofs SET admin_notes = $1 WHERE id = $2`, [adminNotes, id]);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      console.error("Update artwork proof error:", error);
      res.status(500).json({ error: "Failed to update" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Finance Partner Portal
  // ─────────────────────────────────────────────────────────────────────────

  // List all quotes that have been submitted to the finance company
  app.get("/api/finance-portal/deals", isAuthenticated, isFinanceUser, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          q.id,
          q.user_name,
          q.email,
          q.phone,
          q.status         AS quote_status,
          q.finance_status,
          q.finance_notes,
          q.finance_decision_at,
          q.finance_sent_at,
          q.finance_plan_id,
          q.finance_inputs,
          q.van_registration,
          q.van_mileage,
          q.est_total,
          q.est_subtotal,
          q.est_vat,
          q.est_discount,
          v.title          AS van_title,
          k.name           AS kit_name,
          fp.name          AS finance_plan_name
        FROM quotes q
        LEFT JOIN vans v          ON v.id  = q.van_id
        LEFT JOIN kits k          ON k.id  = q.kit_id
        LEFT JOIN finance_plans fp ON fp.id = q.finance_plan_id
        WHERE q.finance_sent_at IS NOT NULL
        ORDER BY
          CASE WHEN q.finance_status = 'pending' THEN 0 ELSE 1 END,
          q.finance_sent_at DESC
      `);

      res.json(rows.map(r => ({
        id:                r.id,
        userName:          r.user_name,
        email:             r.email,
        phone:             r.phone,
        quoteStatus:       r.quote_status,
        financeStatus:     r.finance_status,
        financeNotes:      r.finance_notes,
        financeDecisionAt: r.finance_decision_at,
        financeSentAt:     r.finance_sent_at,
        financePlanId:     r.finance_plan_id,
        financePlanName:   r.finance_plan_name,
        financeInputs:     r.finance_inputs,
        vanRegistration:   r.van_registration,
        vanMileage:        r.van_mileage,
        vanTitle:          r.van_title,
        kitName:           r.kit_name,
        estTotal:          r.est_total,
        estSubtotal:       r.est_subtotal,
        estVat:            r.est_vat,
        estDiscount:       r.est_discount,
      })));
    } catch (error) {
      console.error("Finance portal GET deals error:", error);
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  // Finance partner updates their decision on a deal
  app.patch("/api/finance-portal/deals/:id", isAuthenticated, isFinanceUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { financeStatus, financeNotes } = z.object({
        financeStatus: z.enum(["pending", "approved", "declined", "more_info_needed"]),
        financeNotes:  z.string().max(2000).optional().default(""),
      }).parse(req.body);

      // Map finance decision → overall quote status
      const quoteStatusMap: Record<string, string> = {
        approved:         "finance_approved",
        declined:         "finance_declined",
        pending:          "awaiting_finance",
        more_info_needed: "awaiting_finance",
      };

      // Verify deal exists and was actually sent to finance
      const { rows: existing } = await pool.query(
        `SELECT id, user_name, email, status, finance_status FROM quotes WHERE id = $1 AND finance_sent_at IS NOT NULL`,
        [id]
      );
      if (existing.length === 0) return res.status(404).json({ error: "Deal not found" });
      const quote = existing[0];

      // Only move the overall pipeline status while the quote is still in the
      // finance stage — a finance-notes update must not yank an in-build (or
      // completed) quote back to "awaiting_finance".
      const financeStageStatuses = ["awaiting_finance", "finance_approved", "finance_declined", "payment_finance"];
      const shouldUpdateStatus = financeStageStatuses.includes(quote.status);

      // Update the quote
      if (shouldUpdateStatus) {
        await pool.query(
          `UPDATE quotes
           SET finance_status     = $1,
               finance_notes      = $2,
               finance_decision_at = NOW(),
               status             = $3,
               status_changed_at  = NOW()
           WHERE id = $4`,
          [financeStatus, financeNotes || null, quoteStatusMap[financeStatus], id]
        );
      } else {
        await pool.query(
          `UPDATE quotes
           SET finance_status     = $1,
               finance_notes      = $2,
               finance_decision_at = NOW()
           WHERE id = $3`,
          [financeStatus, financeNotes || null, id]
        );
      }

      // Append a note to admin_notes_history (non-fatal)
      try {
        const { rows: nr } = await pool.query(`SELECT admin_notes_history FROM quotes WHERE id = $1`, [id]);
        const history: any[] = Array.isArray(nr[0]?.admin_notes_history) ? nr[0].admin_notes_history : [];
        const label = { pending: "In Review", approved: "Approved", declined: "Declined", more_info_needed: "More Info Needed" }[financeStatus] ?? financeStatus;
        history.push({
          text:      `Finance partner updated decision to "${label}"${financeNotes ? `. Notes: "${financeNotes}"` : ""}`,
          timestamp: new Date().toISOString(),
          author:    "Finance Portal",
        });
        await pool.query(`UPDATE quotes SET admin_notes_history = $1 WHERE id = $2`, [JSON.stringify(history), id]);
      } catch { /* non-fatal */ }

      // Email the MTV team (non-fatal)
      try {
        const { sendEmail, isTestEmail, getInternalNotifyEmails } = await import("./email.js");
        const INTERNAL_NOTIFY_EMAILS = await getInternalNotifyEmails('finance_update');
        if (isTestEmail(quote.email)) throw new Error("suppressed-test-email");
        const statusEmoji: Record<string, string> = { pending: "🔄", approved: "✅", declined: "❌", more_info_needed: "⚠️" };
        const statusLabel: Record<string, string> = { pending: "In Review", approved: "Approved", declined: "Declined", more_info_needed: "More Info Needed" };
        const subject = `Finance Update — ${quote.user_name}: ${statusEmoji[financeStatus]} ${statusLabel[financeStatus]}`;
        const notesHtml = financeNotes
          ? `<div style="margin-top:16px;background:#f9fafb;border-left:4px solid ${BRAND.theme.accentHex};padding:12px 16px;border-radius:0 4px 4px 0;">
               <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;">Notes from finance partner</p>
               <p style="margin:0;white-space:pre-wrap;color:#111827;">${financeNotes}</p>
             </div>`
          : "";
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <div style="background:${BRAND.theme.darkHex};padding:16px 24px;">
              <h1 style="margin:0;font-size:17px;color:${BRAND.theme.accentHex};">Finance Partner Portal</h1>
              <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,.5);">${BRAND.name}</p>
            </div>
            <div style="padding:24px;">
              <h2 style="margin:0 0 16px;font-size:15px;color:#111;">Finance decision updated</h2>
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:8px;">
                <tr style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:8px 0;color:#6b7280;width:110px;">Customer</td>
                  <td style="padding:8px 0;font-weight:600;">${quote.user_name}</td>
                </tr>
                <tr style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:8px 0;color:#6b7280;">Quote Ref</td>
                  <td style="padding:8px 0;font-family:monospace;">#${(id as string).slice(-6).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;">Decision</td>
                  <td style="padding:8px 0;font-weight:700;font-size:15px;">${statusEmoji[financeStatus]} ${statusLabel[financeStatus]}</td>
                </tr>
              </table>
              ${notesHtml}
              <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Log in to the admin portal to view the full quote and take the next steps.</p>
            </div>
          </div>`;
        await sendEmail({ to: INTERNAL_NOTIFY_EMAILS, subject, html });
      } catch (emailErr) {
        console.error("Finance portal notification email failed:", emailErr);
      }

      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      console.error("Finance portal PATCH deal error:", error);
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  // Public: get artwork proof info by token
  app.get("/api/artwork-approval/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { rows } = await pool.query(
        `SELECT ap.*, c.name AS customer_name FROM artwork_proofs ap JOIN customers c ON c.id = ap.customer_id WHERE ap.token = $1`,
        [token]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Approval link not found or has expired" });
      const proof = rows[0];
      const rawFiles: Array<{ url: string; name: string }> = Array.isArray(proof.files) ? proof.files : JSON.parse(proof.files);
      res.json({
        customerName: proof.customer_name,
        files: rawFiles.map(f => ({ ...f, url: normalizeArtworkFileUrl(f.url) })),
        status: proof.status,
        customerNotes: proof.customer_notes,
        adminNotes: proof.admin_notes,
      });
    } catch (error) {
      console.error("Get artwork approval error:", error);
      res.status(500).json({ error: "Failed to fetch approval info" });
    }
  });

  // Public: submit artwork approval or change request
  app.post("/api/artwork-approval/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { approved, notes } = z.object({
        approved: z.boolean(),
        notes: z.string().optional(),
      }).parse(req.body);

      if (!approved && (!notes || !notes.trim())) {
        return res.status(400).json({ error: "Please describe what changes are needed" });
      }

      const { rows } = await pool.query(`SELECT * FROM artwork_proofs WHERE token = $1`, [token]);
      if (rows.length === 0) return res.status(404).json({ error: "Approval link not found" });
      const proof = rows[0];

      const newStatus = approved ? 'approved' : 'changes_requested';
      await pool.query(
        `UPDATE artwork_proofs SET status = $1, customer_notes = $2, responded_at = NOW() WHERE id = $3`,
        [newStatus, approved ? null : (notes?.trim() ?? null), proof.id]
      );

      // Notify internal team
      try {
        const customer = await storage.getCustomer(proof.customer_id);
        const { sendEmail, isTestEmail, getInternalNotifyEmails } = await import('./email.js');
        const INTERNAL_NOTIFY_EMAILS = await getInternalNotifyEmails('artwork_approval');
        if (isTestEmail(customer?.email)) throw new Error("suppressed-test-email");
        const subject = approved
          ? `Artwork Approved — ${customer?.name ?? 'Customer'}`
          : `Artwork Changes Requested — ${customer?.name ?? 'Customer'}`;
        const html = approved
          ? `<h2>Customer approved their artwork</h2><p><strong>Customer:</strong> ${customer?.name}</p><p style="color:#166534;">The customer is happy with the artwork and has approved it.</p>`
          : `<h2>Customer requested changes to their artwork</h2><p><strong>Customer:</strong> ${customer?.name}</p><hr/><h3>Customer's notes:</h3><p style="white-space:pre-wrap; background:#fef2f2; padding:12px; border-radius:6px; border-left:4px solid #ef4444;">${notes?.trim()}</p>`;
        await sendEmail({ to: INTERNAL_NOTIFY_EMAILS, subject, html });
      } catch { /* non-fatal */ }

      res.json({ ok: true, status: newStatus });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      console.error("Submit artwork approval error:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  // ── Upgrade Categories CRUD ────────────────────────────────────────────────

  app.get("/api/admin/upgrade-categories", isBasicAdmin, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, label, sort_order AS "sortOrder" FROM upgrade_categories ORDER BY sort_order ASC, label ASC`
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Get upgrade categories:", err);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/admin/upgrade-categories", isFullAdmin, async (req, res) => {
    try {
      const { label } = z.object({ label: z.string().min(1).max(100) }).parse(req.body);
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const nextOrder = await pool.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM upgrade_categories`
      );
      const sortOrder = nextOrder.rows[0].next;
      await pool.query(
        `INSERT INTO upgrade_categories (id, label, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label`,
        [id, label, sortOrder]
      );
      res.json({ id, label, sortOrder });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      console.error("Create upgrade category:", err);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/admin/upgrade-categories/:id", isFullAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { label } = z.object({ label: z.string().min(1).max(100) }).parse(req.body);
      const result = await pool.query(
        `UPDATE upgrade_categories SET label = $1 WHERE id = $2
         RETURNING id, label, sort_order AS "sortOrder"`,
        [label, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: "Category not found" });
      res.json(result.rows[0]);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      console.error("Update upgrade category:", err);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/admin/upgrade-categories/:id", isFullAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const inUse = await pool.query(
        `SELECT COUNT(*) AS count FROM upgrades WHERE category = $1`, [id]
      );
      const count = parseInt(inUse.rows[0].count, 10);
      if (count > 0) {
        return res.status(409).json({
          error: `Cannot delete — ${count} upgrade${count === 1 ? "" : "s"} use this category. Reassign them first.`
        });
      }
      await pool.query(`DELETE FROM upgrade_categories WHERE id = $1`, [id]);
      res.json({ ok: true });
    } catch (err) {
      console.error("Delete upgrade category:", err);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  app.put("/api/admin/upgrade-categories/order", isFullAdmin, async (req, res) => {
    try {
      const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (let i = 0; i < ids.length; i++) {
          await client.query(
            `UPDATE upgrade_categories SET sort_order = $1 WHERE id = $2`,
            [i, ids[i]]
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Invalid data" });
      console.error("Reorder upgrade categories:", err);
      res.status(500).json({ error: "Failed to reorder categories" });
    }
  });

  // ── End Upgrade Categories ─────────────────────────────────────────────────

  // ── Twilio / Click-to-Call ─────────────────────────────────────────────────

  // Check whether Twilio creds are present
  app.get("/api/admin/twilio/status", isAuthenticated, isBasicAdmin, (_req, res) => {
    const configured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );
    res.json({ configured });
  });

  // Staff phone numbers — global list, full-admin management only
  // Basic admins can read (needed to show the call dialog) but cannot write
  app.get("/api/admin/staff-phones", isAuthenticated, isBasicAdmin, async (_req, res) => {
    try {
      const phones = await storage.getStaffPhones();
      res.json(phones);
    } catch (err) {
      console.error("GET staff-phones:", err);
      res.status(500).json({ error: "Failed to load staff phones" });
    }
  });

  app.post("/api/admin/staff-phones", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { label, phone, sortOrder } = req.body;
      if (!phone) return res.status(400).json({ error: "phone is required" });
      const record = await storage.createStaffPhone({ label: label || "Mobile", phone, sortOrder: sortOrder ?? 0 });
      res.json(record);
    } catch (err) {
      console.error("POST staff-phones:", err);
      res.status(500).json({ error: "Failed to create staff phone" });
    }
  });

  app.patch("/api/admin/staff-phones/:id", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const existing = await storage.getStaffPhone(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      const { label, phone, sortOrder } = req.body;
      const record = await storage.updateStaffPhone(req.params.id, {
        ...(label !== undefined && { label }),
        ...(phone !== undefined && { phone }),
        ...(sortOrder !== undefined && { sortOrder }),
      });
      if (!record) return res.status(404).json({ error: "Not found" });
      res.json(record);
    } catch (err) {
      console.error("PATCH staff-phones:", err);
      res.status(500).json({ error: "Failed to update staff phone" });
    }
  });

  app.delete("/api/admin/staff-phones/:id", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const existing = await storage.getStaffPhone(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });
      await storage.deleteStaffPhone(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      console.error("DELETE staff-phones:", err);
      res.status(500).json({ error: "Failed to delete staff phone" });
    }
  });

  // TwiML webhook — Twilio calls this when the staff member answers; it then dials the customer
  // Validates Twilio request signature when auth token is present (defense-in-depth)
  async function twimlHandler(req: express.Request, res: express.Response) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      try {
        const { default: twilio } = await import("twilio");
        const signature = req.headers["x-twilio-signature"] as string | undefined;
        const proto = (req.get("x-forwarded-proto") as string) || req.protocol;
        const fullUrl = `${proto}://${req.get("host")}${req.originalUrl}`;
        const params = req.method === "POST" ? (req.body ?? {}) : {};
        if (signature && !twilio.validateRequest(authToken, signature, fullUrl, params)) {
          return res.status(403).send("<Response><Say>Forbidden</Say></Response>");
        }
      } catch { /* validation failure is non-fatal in dev where secrets may differ */ }
    }
    const rawTo = ((req.query.to as string) || (req.body?.to as string) || "");
    const to = rawTo.replace(/[^0-9+]/g, "");
    res.set("Content-Type", "text/xml");
    if (!to) {
      return res.send("<Response><Say>Sorry, the destination number is missing. Goodbye.</Say></Response>");
    }
    const from = process.env.TWILIO_FROM_NUMBER || "";
    res.send(
      `<Response><Dial callerId="${from}"><Number>${to}</Number></Dial></Response>`
    );
  }
  app.get("/api/admin/calls/twiml", twimlHandler);
  app.post("/api/admin/calls/twiml", twimlHandler);

  // Initiate outbound bridge call: Twilio calls staff → on answer, connects to customer
  app.post("/api/admin/calls/initiate", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken  = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        return res.status(503).json({
          error: "Twilio is not configured. Ask your system administrator to add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.",
        });
      }

      const { staffNumberId, toNumber: rawToNumber, quoteId, leadId } = req.body;
      if (!staffNumberId || !rawToNumber) {
        return res.status(400).json({ error: "staffNumberId and toNumber are required" });
      }
      // Normalise UK local numbers (07xxx / 447xxx) to E.164 (+447xxx)
      const normaliseToE164 = (n: string): string => {
        const digits = n.replace(/[\s\-().]/g, "");
        if (/^07\d{9}$/.test(digits)) return "+44" + digits.slice(1);
        if (/^447\d{9}$/.test(digits)) return "+" + digits;
        return digits;
      };
      const toNumber = normaliseToE164(rawToNumber);
      // Basic E.164 validation — must start with + followed by digits only
      if (!/^\+[1-9]\d{6,14}$/.test(toNumber)) {
        return res.status(400).json({ error: "toNumber must be in E.164 format (e.g. +447700000000)" });
      }

      // Validate the staffNumberId exists in our DB — prevents arbitrary dialling
      const staffPhoneRecord = await storage.getStaffPhone(staffNumberId);
      if (!staffPhoneRecord) {
        return res.status(404).json({ error: "Staff phone number not found" });
      }
      const staffPhone = staffPhoneRecord.phone;

      const { default: twilio } = await import("twilio");
      const client = twilio(accountSid, authToken);

      const host     = req.get("host")!;
      const protocol = (req.get("x-forwarded-proto") as string) || req.protocol;
      const twimlUrl = `${protocol}://${host}/api/admin/calls/twiml?to=${encodeURIComponent(toNumber)}`;

      await client.calls.create({ to: staffPhone, from: fromNumber, url: twimlUrl, method: "GET" });

      // Log the call attempt as an admin note (non-fatal)
      try {
        const staffUser = req.user as User | undefined;
        const author    = staffUser?.username || "Staff";
        const noteText  = `Click-to-call initiated — staff: ${staffPhone} (${staffPhoneRecord.label}) → customer: ${toNumber}`;
        const entry: { text: string; timestamp: string; author: string } = { text: noteText, timestamp: new Date().toISOString(), author };

        if (quoteId) {
          const { rows } = await pool.query(`SELECT admin_notes_history FROM quotes WHERE id = $1`, [quoteId]);
          const hist: Array<{ text: string; timestamp: string; author?: string }> =
            Array.isArray(rows[0]?.admin_notes_history) ? rows[0].admin_notes_history : [];
          hist.push(entry);
          await pool.query(`UPDATE quotes SET admin_notes_history = $1 WHERE id = $2`, [JSON.stringify(hist), quoteId]);
        }
        if (leadId) {
          // Always log to lead crm_notes timeline (no customer linkage required)
          const { rows: leadRows } = await pool.query(`SELECT crm_notes FROM leads WHERE id = $1`, [leadId]);
          if (leadRows[0]) {
            const leadHist: Array<{ text: string; timestamp: string; author?: string }> =
              Array.isArray(leadRows[0].crm_notes) ? leadRows[0].crm_notes : [];
            leadHist.push(entry);
            await pool.query(`UPDATE leads SET crm_notes = $1 WHERE id = $2`, [JSON.stringify(leadHist), leadId]);
          }
          // Also log to customer notes if the lead is linked to a customer
          await pool.query(
            `INSERT INTO customer_notes (customer_id, author_name, note_type, text)
             SELECT customer_id, $1, 'call', $2 FROM leads WHERE id = $3 AND customer_id IS NOT NULL`,
            [author, noteText, leadId]
          );
        }
      } catch { /* non-fatal */ }

      res.json({ ok: true, message: "Your phone will ring in a moment. Answer it to be connected to the customer." });
    } catch (err: any) {
      console.error("Twilio call initiation error:", err);
      res.status(500).json({ error: err?.message || "Failed to initiate call" });
    }
  });

  // ── End Twilio / Click-to-Call ─────────────────────────────────────────────

  // ── Stock Tracking (BOM QR scan deduction workflow) ───────────────────────

  // GET all stock items
  app.get("/api/admin/stock", isAuthenticated, isBasicAdmin, async (_req, res) => {
    try {
      const items = await storage.getStockItems();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET low stock count (for dashboard badge)
  app.get("/api/admin/stock/low-stock-count", isAuthenticated, isBasicAdmin, async (_req, res) => {
    try {
      const count = await storage.getLowStockCount();
      res.json({ count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET single stock item by SKU
  // GET BOM sync history log — registered BEFORE the :sku route below, which
  // would otherwise swallow "bom-sync-history" as a SKU and 404 it.
  app.get("/api/admin/stock/bom-sync-history", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const history = await storage.getBomSyncHistory(limit);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/stock/:sku", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const item = await storage.getStockItem(req.params.sku);
      if (!item) return res.status(404).json({ error: "Not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT/PATCH upsert a stock item — only full admins can change stock levels by hand
  app.put("/api/admin/stock/:sku", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const body = req.body as { description?: string; onHand?: number; lowStockThreshold?: number | null };
      const data: Record<string, any> = {};
      if (body.description !== undefined) data.description = body.description;
      if (body.onHand !== undefined) data.onHand = Number(body.onHand);
      // Allow explicit null to clear the threshold; absent key = don't touch it
      if ('lowStockThreshold' in body) {
        data.lowStockThreshold = body.lowStockThreshold === null ? null : Number(body.lowStockThreshold);
      }
      const item = await storage.upsertStockItem(req.params.sku, data);
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH adjust stock on-hand by a relative delta (±integer, full admins only)
  app.patch("/api/admin/stock/:sku", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { delta } = req.body as { delta: number };
      if (delta === undefined || isNaN(Number(delta))) {
        return res.status(400).json({ error: "delta (integer) is required" });
      }
      const d = Math.trunc(Number(delta));
      if (d === 0) {
        const existing = await storage.getStockItem(req.params.sku);
        if (!existing) return res.status(404).json({ error: "Not found" });
        return res.json(existing);
      }
      const item = await storage.adjustStockDelta(req.params.sku, d);
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET preview of how many new SKUs a BOM sync would import
  app.get("/api/admin/stock/sync-from-bom/preview", isAuthenticated, isFullAdmin, async (_req, res) => {
    try {
      const preview = await storage.previewSyncFromBom();
      res.json(preview);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST bulk-update low-stock thresholds for multiple SKUs at once
  app.post("/api/admin/stock/bulk-thresholds", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { updates } = req.body as { updates: { sku: string; threshold: number | null }[] };
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: "updates array is required" });
      }
      const results = await Promise.all(
        updates.map(({ sku, threshold }) =>
          storage.upsertStockItem(sku, {
            lowStockThreshold: threshold != null ? Math.max(0, Math.trunc(Number(threshold))) : null,
          })
        )
      );
      res.json({ updated: results.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST sync stock_items from all BOM component SKUs (creates missing rows at on_hand=0)
  app.post("/api/admin/stock/sync-from-bom", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { defaultThreshold } = req.body as { defaultThreshold?: number };
      const threshold = typeof defaultThreshold === "number" && defaultThreshold >= 0 ? Math.floor(defaultThreshold) : undefined;
      const sessionUser = (req.session as any)?.user;
      const triggeredBy: string | undefined = sessionUser?.username ?? sessionUser?.email ?? undefined;
      const result = await storage.syncStockFromBom(threshold, triggeredBy);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST deduct stock by scanning a QR code (basic admins — workshop staff)
  app.post("/api/admin/stock/:sku/deduct", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { quantity = 1, quoteId, buildSheetRef, kitId, upgradeId } = req.body as {
        quantity?: number;
        quoteId?: string;
        buildSheetRef?: string;
        kitId?: string;
        upgradeId?: string;
      };
      const qty = Math.max(1, Math.floor(Number(quantity) || 1));
      const sessionId = (req as any).sessionID ?? undefined;
      const item = await storage.deductStock(
        req.params.sku,
        qty,
        quoteId,
        buildSheetRef,
        sessionId,
        kitId,
        upgradeId
      );
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET deduction history for a SKU
  app.get("/api/admin/stock/:sku/history", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const history = await storage.getStockDeductionHistory(
        req.params.sku,
        req.query.limit ? Number(req.query.limit) : 50
      );
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── End Stock Tracking ──────────────────────────────────────────────────────

  // ── Dev-only test helpers (never available in production) ─────────────────
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.REPLIT_DEPLOYMENT !== '1' &&
    process.env.E2E_TEST_MODE === '1'
  ) {
    /**
     * POST /api/dev/create-test-user
     * Creates (or resets) a user with a known password for e2e tests.
     * Body: { username, password, adminRole }
     * Only available in development with E2E_TEST_MODE=1 — never exposed in production.
     */
    app.post('/api/dev/create-test-user', async (req, res) => {
      try {
        const { username, password, adminRole = 'none', email } = req.body as {
          username: string;
          password: string;
          adminRole?: string;
          email?: string;
        };
        if (!username || !password) {
          return res.status(400).json({ message: 'username and password are required' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const resolvedEmail = email || `${username}@e2e.test.local`;

        const existing = await storage.getUserByUsername(username);
        if (existing) {
          await storage.updateUser(existing.id, {
            passwordHash,
            adminRole: adminRole as 'none' | 'basic' | 'full' | 'finance',
            isAdmin: adminRole === 'full',
          });
          return res.json({ ok: true, action: 'updated', id: existing.id });
        }

        const newUser = await storage.createUser({
          username,
          email: resolvedEmail,
          passwordHash,
          adminRole: adminRole as 'none' | 'basic' | 'full' | 'finance',
          isAdmin: adminRole === 'full',
          firstName: null,
          lastName: null,
          profileImageUrl: null,
        });
        res.json({ ok: true, action: 'created', id: newUser.id });
      } catch (err) {
        console.error('Dev create-test-user error:', err);
        res.status(500).json({ message: 'Failed to create test user' });
      }
    });
  }
  // ── WrapGen artwork approval integration ──────────────────────────────────

  // Save (or update) the WrapGen 3D render URL against a quote.
  // The design team uploads artwork to WrapGen externally; staff paste the
  // resulting preview URL here so MTV can track customer approval via webhook.
  app.patch("/api/admin/quotes/:id/wrapgen-proof", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { previewUrl } = z.object({ previewUrl: z.string().url("Must be a valid URL") }).parse(req.body);
      // Safely extract the preview ID from the URL pathname only (no query strings or fragments).
      // e.g. https://app.wrapgen.com/preview/abc123?token=x  →  "abc123"
      let previewId: string;
      try {
        const parsed = new URL(previewUrl);
        previewId = parsed.pathname.split("/").filter(Boolean).pop() ?? previewUrl;
      } catch {
        previewId = previewUrl.split("/").filter(Boolean).pop() ?? previewUrl;
      }
      await pool.query(
        `UPDATE quotes
         SET wrapgen_preview_id    = $1,
             wrapgen_preview_url   = $2,
             wrapgen_proof_sent_at = NOW()
         WHERE id = $3`,
        [previewId, previewUrl, req.params.id]
      );
      res.json({ ok: true, previewId, previewUrl });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0]?.message ?? "Invalid URL" });
      console.error("WrapGen proof save error:", err);
      res.status(500).json({ error: "Failed to save WrapGen proof URL" });
    }
  });

  // List all quotes that have a WrapGen preview linked, for the artwork approvals dashboard.
  app.get("/api/admin/artwork-approvals", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          q.id,
          q.user_name,
          q.email,
          q.wrapgen_preview_id,
          q.wrapgen_preview_url,
          q.artwork_approved_at,
          q.artwork_approved_by,
          q.wrapgen_proof_sent_at,
          q.created_at,
          q.status,
          q.selected_upgrade_ids,
          v.make,
          v.model,
          v.year,
          q.custom_van_description,
          -- Derive wrap type name from selected upgrade IDs joined to upgrades table
          (
            SELECT u.name
            FROM upgrades u
            WHERE q.selected_upgrade_ids IS NOT NULL
              AND u.id = ANY(q.selected_upgrade_ids)
              AND (u.name ~* 'wrap|graphics|livery')
            LIMIT 1
          ) AS wrap_type_name
        FROM quotes q
        LEFT JOIN vans v ON v.id = q.van_id
        WHERE q.wrapgen_preview_id IS NOT NULL
        ORDER BY COALESCE(q.wrapgen_proof_sent_at, q.created_at) DESC
      `);
      res.json(rows);
    } catch (err) {
      console.error("Artwork approvals list error:", err);
      res.status(500).json({ error: "Failed to load artwork approvals" });
    }
  });

  // Webhook — called by WrapGen when a customer approves their artwork proof.
  // Validated with a shared secret header like the other webhook receivers;
  // without WRAPGEN_WEBHOOK_SECRET configured the endpoint refuses requests
  // rather than accepting anonymous state changes.
  app.post("/api/webhooks/wrapgen", async (req, res) => {
    try {
      const wrapgenSecret = process.env.WRAPGEN_WEBHOOK_SECRET;
      if (!wrapgenSecret || req.headers["x-webhook-secret"] !== wrapgenSecret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { event, previewId, approvedByName, approvedAt } = req.body ?? {};
      if (event !== "artwork.approved") return res.json({ ok: true, skipped: true });
      if (!previewId) return res.status(400).json({ error: "Missing previewId" });

      const { rows } = await pool.query(
        `SELECT id FROM quotes WHERE wrapgen_preview_id = $1 LIMIT 1`,
        [String(previewId)]
      );
      if (rows.length === 0) return res.json({ ok: true, skipped: true }); // unknown preview — ignore

      const quoteId: string = rows[0].id;
      const approvedAtDate = approvedAt ? new Date(approvedAt) : new Date();
      const approverName: string = typeof approvedByName === "string" && approvedByName.trim()
        ? approvedByName.trim()
        : "Customer";

      // Idempotent: check whether this quote is already approved before writing.
      // WrapGen may retry webhooks; we must not duplicate the timeline note.
      const { rows: existing } = await pool.query(
        `SELECT artwork_approved_at FROM quotes WHERE id = $1 LIMIT 1`,
        [quoteId]
      );
      const alreadyApproved = existing[0]?.artwork_approved_at != null;

      await pool.query(
        `UPDATE quotes
         SET artwork_approved_at = $1,
             artwork_approved_by  = $2
         WHERE id = $3`,
        [approvedAtDate, approverName, quoteId]
      );

      // Auto-seed Due-By date = artwork-approved + 9 weeks (max lead time).
      // Only when no target_completion_date has been set yet — never overwrite
      // a manual override entered by staff. Idempotent on webhook retries.
      const { WEEK_MS: _WK, DUE_BY_LEAD_WEEKS_MAX: _MAX } = await import("@shared/dueByCountdown");
      const seededTarget = new Date(approvedAtDate.getTime() + _MAX * _WK);
      await pool.query(
        `UPDATE quotes
         SET target_completion_date = $1
         WHERE id = $2 AND target_completion_date IS NULL`,
        [seededTarget, quoteId]
      );

      // Append the timeline note only on first approval — skip if already recorded
      if (!alreadyApproved) {
        await pool.query(
          `UPDATE quotes
           SET admin_notes_history = COALESCE(admin_notes_history, '[]'::jsonb) || $1::jsonb
           WHERE id = $2`,
          [
            JSON.stringify([{
              text: `Wrap artwork approved via WrapGen by ${approverName}.`,
              timestamp: approvedAtDate.toISOString(),
              author: "WrapGen",
            }]),
            quoteId,
          ]
        );
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("WrapGen webhook error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ── WrapGen auto-link: generate a one-time token for a quote ─────────────
  // Staff click "Open in WrapGen" in MTV — this generates a short-lived token
  // and returns a WrapGen URL with the token embedded. WrapGen then fires back
  // to /api/webhooks/wrapgen-link/:token when the preview is created.
  app.post("/api/admin/quotes/:id/wrapgen-link-token", isAuthenticated, isBasicAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await pool.query(
        `INSERT INTO wrapgen_link_tokens (token, quote_id, expires_at) VALUES ($1, $2, $3)`,
        [token, id, expiresAt]
      );

      const { rows } = await pool.query(`SELECT user_name, email FROM quotes WHERE id = $1`, [id]);
      const quote = rows[0];
      const quoteRef = encodeURIComponent(quote?.user_name || quote?.email || "Quote");

      const base = `${req.protocol}://${req.get("host")}`;
      const webhookUrl = encodeURIComponent(`${base}/api/webhooks/wrapgen-link/${token}`);
      const wrapgenUrl = `http://wrapgen.co.uk?mtv_token=${token}&mtv_webhook=${webhookUrl}&mtv_ref=${quoteRef}`;

      res.json({ token, wrapgenUrl });
    } catch (err) {
      console.error("WrapGen link token error:", err);
      res.status(500).json({ error: "Failed to generate link token" });
    }
  });

  // ── WrapGen auto-link: receive preview URL back from WrapGen ──────────────
  // WrapGen POSTs here when a preview is generated for a session that was
  // opened from MTV. Public endpoint — protected by the one-time token.
  app.post("/api/webhooks/wrapgen-link/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { previewId, previewUrl } = req.body ?? {};

      if (!previewUrl) return res.status(400).json({ error: "Missing previewUrl" });

      const { rows } = await pool.query(
        `SELECT quote_id, expires_at, used_at FROM wrapgen_link_tokens WHERE token = $1 LIMIT 1`,
        [token]
      );
      if (rows.length === 0) return res.status(404).json({ error: "Token not found" });

      const { quote_id, expires_at, used_at } = rows[0];
      if (used_at) return res.json({ ok: true, skipped: true, reason: "already used" });
      if (new Date(expires_at) < new Date()) return res.status(410).json({ error: "Token expired — please generate a new link from MTV" });

      // Derive previewId from the URL if not sent separately
      const resolvedPreviewId = previewId ?? (() => {
        try { return new URL(String(previewUrl)).pathname.split("/").filter(Boolean).pop() ?? token; }
        catch { return token; }
      })();

      await pool.query(
        `UPDATE quotes
         SET wrapgen_preview_id    = $1,
             wrapgen_preview_url   = $2,
             wrapgen_proof_sent_at = NOW()
         WHERE id = $3`,
        [String(resolvedPreviewId), String(previewUrl), quote_id]
      );

      await pool.query(
        `UPDATE wrapgen_link_tokens SET used_at = NOW() WHERE token = $1`,
        [token]
      );

      res.json({ ok: true, quoteId: quote_id });
    } catch (err) {
      console.error("WrapGen link webhook error:", err);
      res.status(500).json({ error: "Failed to process WrapGen link" });
    }
  });

  // ── Kiosk pipeline board ────────────────────────────────────────────────────

  // GET  /api/admin/pipeline-board/kiosk-token
  // Returns the current kiosk token (any admin can view — they need it to share the URL)
  app.get("/api/admin/pipeline-board/kiosk-token", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json({ token: settings["pipeline_kiosk_token"] || null });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch kiosk token" });
    }
  });

  // POST /api/admin/pipeline-board/kiosk-token/regenerate
  // Creates a new 64-char hex token, invalidating the old URL (full admin only)
  app.post("/api/admin/pipeline-board/kiosk-token/regenerate", isAuthenticated, isFullAdmin, async (req, res) => {
    try {
      const token = crypto.randomBytes(32).toString("hex");
      await storage.setSiteSetting("pipeline_kiosk_token", token);
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: "Failed to regenerate kiosk token" });
    }
  });

  // POST /api/kiosk/pipeline/:token/status
  // Token-gated status change from the kiosk (currently only In Build -> In Workshop)
  app.post("/api/kiosk/pipeline/:token/status", async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      const validToken = settings["pipeline_kiosk_token"];
      if (!validToken || req.params.token !== validToken) {
        return res.status(401).json({ error: "Invalid or expired kiosk token" });
      }
      const body = z.object({
        quoteId: z.string().min(1),
        status: z.enum(["in_workshop", "in_build", "completed"]),
      }).parse(req.body);
      const quote = await storage.getQuote(body.quoteId);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      // Allow the safe transitions from the kiosk:
      //  • In Build  ↔ In Workshop (swap during a build)
      //  • In Build  → Completed   (van finished — all stages ticked)
      //  • In Workshop → Completed
      const allowed =
        (quote.status === "in_build"    && body.status === "in_workshop") ||
        (quote.status === "in_workshop" && body.status === "in_build")    ||
        (quote.status === "in_build"    && body.status === "completed")   ||
        (quote.status === "in_workshop" && body.status === "completed");
      if (!allowed) {
        return res.status(400).json({ error: `Cannot move ${quote.status} -> ${body.status} from kiosk` });
      }
      await storage.updateQuote(quote.id, { status: body.status } as any);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // POST /api/kiosk/pipeline/:token/target-date
  // Token-gated due-by date edit from the kiosk. Accepts ISO string or null to clear.
  app.post("/api/kiosk/pipeline/:token/target-date", async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      const validToken = settings["pipeline_kiosk_token"];
      if (!validToken || req.params.token !== validToken) {
        return res.status(401).json({ error: "Invalid or expired kiosk token" });
      }
      const body = z.object({
        quoteId: z.string().min(1),
        targetCompletionDate: z.string().nullable(),
      }).parse(req.body);
      const quote = await storage.getQuote(body.quoteId);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      const newDate = body.targetCompletionDate ? new Date(body.targetCompletionDate) : null;
      if (newDate !== null && isNaN(newDate.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }
      await storage.updateQuote(quote.id, { targetCompletionDate: newDate } as any);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update due-by date" });
    }
  });

  // GET /api/kiosk/pipeline/:token
  // Public (no login), token-gated.  Returns the minimal data needed by the wallboard.
  // Deliberately excludes email, financial details, internal notes, etc.
  app.get("/api/kiosk/pipeline/:token", async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const settings = await storage.getSiteSettings();
      const validToken = settings["pipeline_kiosk_token"];
      if (!validToken || req.params.token !== validToken) {
        return res.status(401).json({ error: "Invalid or expired kiosk token" });
      }

      const COMMITTED = new Set(["deposit_taken", "finance_approved", "in_build", "in_workshop"]);
      const [allQuotes, vans, kits, upgrades] = await Promise.all([
        storage.getQuotes(),
        storage.getVans(),
        storage.getKitsAdmin(),
        storage.getAllUpgradesAdmin(),
      ]);

      // Ensure every committed quote has a confirmationToken so the QR code works
      const committedRaw = allQuotes.filter((q) => COMMITTED.has(q.status));
      await Promise.all(
        committedRaw
          .filter((q) => !q.confirmationToken)
          .map(async (q) => {
            const token = crypto.randomBytes(32).toString("hex");
            await storage.updateQuote(q.id, { confirmationToken: token } as any);
            q.confirmationToken = token; // mutate in-memory so the map below picks it up
          })
      );

      // Dedupe selectedUpgradeIds by parentId — variant groups are radio-style
      // in the configurator, so a quote should only render one variant per
      // parent (e.g. one CCTV, one Light Pack). Mirrors the same rule used by
      // the workshop QR endpoint above so both screens show identical lists.
      const upgradesById = new Map((upgrades as any[]).map((u) => [u.id, u] as const));
      const dedupeIdsByParent = (ids: string[]): string[] => {
        const seenParents = new Set<string>();
        const out: string[] = [];
        for (const id of ids) {
          const u: any = upgradesById.get(id);
          if (!u) { out.push(id); continue; }
          const pid = u.parentId as string | null | undefined;
          if (pid) {
            if (seenParents.has(pid)) continue;
            seenParents.add(pid);
          }
          out.push(id);
        }
        return out;
      };

      const quotes = committedRaw.map((q) => ({
          id: q.id,
          status: q.status,
          statusChangedAt: q.statusChangedAt,
          targetCompletionDate: q.targetCompletionDate,
          userName: q.userName,
          phone: q.phone,
          company: q.company,
          vanId: q.vanId,
          customVanDescription: q.customVanDescription,
          kitId: q.kitId,
          selectedUpgradeIds: dedupeIdsByParent((q.selectedUpgradeIds ?? []) as string[]),
          // Quantity map keyed by upgrade id — kiosk uses this to prefix stage
          // labels with "N× " when a customer has ordered more than one of an
          // item (e.g. 2× Compressor). Mirrors the build sheet behaviour.
          selectedUpgrades: (q.selectedUpgrades ?? {}) as Record<string, number>,
          vanRegistration: q.vanRegistration ?? null,
          confirmationToken: q.confirmationToken ?? null,
          // Build sheet progress — completedBuildStages entries are either a bare stage-id string
          // (legacy) or { id, initials } (current format with staff initials)
          completedBuildStages: (q.completedBuildStages ?? []) as Array<string | { id: string; initials: string }>,
          // Custom stage list overrides the auto-generated one; null means auto-generate
          customBuildStages: (q.customBuildStages ?? null) as Array<{ id: string; label: string }> | null,
          // Artwork approval timestamp — used by the kiosk's Due-By countdown
          // to compute the 6wk / 9wk chips relative to the approval date.
          artworkApprovedAt: (q as any).artworkApprovedAt ?? null,
        }));

      res.json({
        quotes,
        vans: vans.map((v) => ({ id: v.id, make: v.make, model: v.model, year: v.year, reg: v.reg ?? null })),
        kits: kits.map((k) => ({
          id: k.id,
          name: k.name,
          // Headline machines (e.g. Tyre Changer, Wheel Balancer, Compressor)
          // — shown as an "Includes:" sub-line under the pack name on each
          // kiosk card so the lads can see at a glance which machines the
          // pack contains without scanning the full BOM. Resolved server-side
          // via the shared helper: admin override wins, otherwise derived
          // from the kit's BOM (skuComponents) by strict keyword match.
          headlineMachines: deriveHeadlineMachines({
            headlineMachines: (k as { headlineMachines?: string[] | null }).headlineMachines ?? null,
            skuComponents: k.skuComponents ?? null,
          }),
        })),
        // Include category so the client can detect wrap/interior-wall upgrades for stage generation.
        // Pre-sorted by catalogue display order so kiosk cards render upgrades consistently.
        // variantName is the distinguishing sibling label — without it the
        // kiosk shows the shared parent name twice (e.g. "Van Online CCTV/NVR
        // System" for every CCTV variant, "Light Pack" for both light packs).
        upgrades: (await sortUpgradesByDisplayOrder(upgrades as any[])).map((u: any) => ({
          id: u.id,
          name: u.name,
          category: u.category ?? "",
          variantName: u.variantName ?? null,
        })),
      });
    } catch (err) {
      console.error("Kiosk pipeline error:", err);
      res.status(500).json({ error: "Failed to fetch pipeline data" });
    }
  });

  // ── End dev-only test helpers ──────────────────────────────────────────────

  const httpServer = createServer(app);

  return httpServer;
}
