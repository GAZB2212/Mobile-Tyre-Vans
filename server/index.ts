import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import cron from "node-cron";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { createUser, getSession } from "./auth";
import { pool } from "./db";
import { generateAiBlogPost } from "./blogGenerator";
import { checkEmailConfig } from "./email";
import { backfillSkus } from "./backfill-skus";

const app = express();

// Session must be first middleware to ensure cookies work properly
app.set("trust proxy", true);
app.use(getSession());

// Gzip compression for all responses
app.use(compression());

// Redirect non-www to www — pages only.
// Never redirect API calls: a 301 on a PUT/PATCH/DELETE makes the browser
// re-issue the request to the www origin, which turns a same-origin write into
// a cross-origin credentialed request and the browser silently drops it (GETs
// still work, writes fail). API requests must stay on whatever host the app was
// loaded from. Canonicalisation only matters for document/page GETs anyway.
app.use((req, res, next) => {
  const isPageRequest = (req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api');
  if (!isPageRequest) return next();
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
  if (host && !host.startsWith('www.') && host.includes('mobiletyrevans.co.uk')) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    return res.redirect(301, `${proto}://www.${host}${req.originalUrl}`);
  }
  next();
});

// HTTP security headers
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Allow camera on admin pages for the QR scanner; block it everywhere else
  const isAdminRoute = _req.path.startsWith('/admin') || _req.path.startsWith('/api/admin');
  res.setHeader(
    'Permissions-Policy',
    isAdminRoute
      ? 'camera=(self), microphone=(), geolocation=()'
      : 'camera=(), microphone=(), geolocation=()'
  );
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Bootstrap admin user on startup
async function bootstrapAdmin() {
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // In production, require explicit credentials — never fall back to defaults
  if (isProduction && (!adminUsername || !adminPassword)) {
    console.error("❌ CRITICAL: ADMIN_USERNAME and ADMIN_PASSWORD environment variables must be set in production.");
    console.error("❌ Admin account will NOT be created. Set these variables and restart to bootstrap the admin.");
    return;
  }

  // In development fall back to safe local defaults only
  const resolvedUsername = adminUsername || "admin";
  const resolvedPassword = adminPassword || "admin123";

  try {
    const existingAdmin = await storage.getUserByUsername(resolvedUsername);
    if (!existingAdmin) {
      const created = await createUser({
        username: resolvedUsername,
        password: resolvedPassword,
        email: "admin@mtv.example.com",
        firstName: "Admin",
        lastName: "User",
        isAdmin: true,
      });
      // createUser defaults adminRole to "none"; without this the bootstrap
      // admin can log in but is locked out of the admin panel until the next
      // restart hits the correction path below.
      await storage.updateUser(created.id, { adminRole: "full" });
      log(`✅ Admin user created: ${resolvedUsername}`);
    } else {
      // Ensure the admin user always has the correct role
      if (existingAdmin.adminRole !== "full") {
        await storage.updateUser(existingAdmin.id, { adminRole: "full", isAdmin: true });
        log(`✅ Admin role corrected to "full" for: ${resolvedUsername}`);
      }

      // Always sync the password hash so it stays consistent with resolvedPassword.
      // In production resolvedPassword comes from ADMIN_PASSWORD; in dev it falls
      // back to "admin123". This prevents stale hashes from blocking login.
      const bcrypt = await import("bcryptjs");
      const newHash = await bcrypt.hash(resolvedPassword, 10);
      await storage.updateUser(existingAdmin.id, { passwordHash: newHash });
      if (adminPassword) {
        log(`✅ Admin password updated from ADMIN_PASSWORD env var`);
      } else {
        log(`✅ Admin user exists: ${resolvedUsername} (password synced to dev default)`);
      }
    }
  } catch (error) {
    console.error("❌ Failed to bootstrap admin user:", error);
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Method/path/status/duration only — stringifying response bodies here
      // serialized multi-MB payloads a second time just to truncate the line.
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("API error:", err);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Bootstrap admin user and run DB migrations AFTER server is listening
    // This prevents blocking deployment initialization
    // Schedule daily follow-up reminder emails at 9am London time
    cron.schedule("0 9 * * *", async () => {
      const today = new Date().toISOString().split('T')[0];
      log(`[Follow-up] Checking for follow-ups on ${today}...`);
      try {
        const followUps = await storage.getFollowUpsNeedingReminder(today);
        if (followUps.length === 0) {
          log("[Follow-up] No reminders to send today.");
          return;
        }
        const { sendFollowUpReminderEmail } = await import('./email.js');
        const baseUrl = process.env.SITE_URL
          || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}` : 'https://www.mobiletyrevans.co.uk');
        let sent = 0;
        for (const fu of followUps) {
          const toEmail = fu.assignedToEmail;
          if (!toEmail) continue;
          try {
            await sendFollowUpReminderEmail({
              to: toEmail,
              assignedToName: fu.assignedToName || 'Team',
              customerName: fu.customerName,
              customerPhone: fu.customerPhone,
              customerEmail: fu.customerEmail,
              scheduledDate: fu.scheduledDate,
              notes: fu.notes,
              leadId: fu.leadId,
              quoteId: fu.quoteId,
              baseUrl,
            });
            await storage.updateFollowUp(fu.id, { reminderSentAt: new Date() });
            sent++;
          } catch (err: any) {
            console.error(`[Follow-up] Failed to send reminder for ${fu.id}:`, err.message);
          }
        }
        log(`[Follow-up] Sent ${sent} reminder email(s).`);
      } catch (err: any) {
        console.error("[Follow-up] Cron error:", err.message);
      }
    }, { timezone: "Europe/London" });

    // Schedule automatic AI blog post generation every Monday at 8am London time
    cron.schedule("0 8 * * 1", async () => {
      log("[Blog AI] Scheduled run — generating post...");
      try {
        const post = await generateAiBlogPost(null, true);
        log(`[Blog AI] Scheduled post saved as draft: "${post.title}"`);
      } catch (err: any) {
        console.error("[Blog AI] Scheduled generation failed:", err.message);
      }
    }, { timezone: "Europe/London" });

    setImmediate(() => {
      checkEmailConfig();
      bootstrapAdmin().catch(err => {
        console.error("Failed to bootstrap admin:", err);
      });
      backfillSkus().catch(err => {
        console.error("Failed to backfill SKUs:", err);
      });

      // One-time idempotent backfill: strip duplicate variants from every
      // quote's selectedUpgradeIds. Variant groups are radio-style in the
      // configurator so only one variant per parent should ever be stored.
      // Rule: keep the FIRST occurrence per parent in the saved array —
      // mirrors the configurator's display rule exactly, so whatever the
      // customer sees in their configurator is what gets saved & built.
      pool.query(`
        WITH dup_quotes AS (
          SELECT q.id, q.selected_upgrade_ids
          FROM quotes q
          WHERE q.selected_upgrade_ids IS NOT NULL
            AND array_length(q.selected_upgrade_ids, 1) > 1
        ),
        expanded AS (
          SELECT q.id AS quote_id, u.id AS upgrade_id, u.parent_id,
                 array_position(q.selected_upgrade_ids, u.id) AS pos
          FROM dup_quotes q
          JOIN upgrades u ON u.id = ANY(q.selected_upgrade_ids)
        ),
        winners AS (
          SELECT DISTINCT ON (quote_id, COALESCE(parent_id, upgrade_id))
                 quote_id, upgrade_id, pos
          FROM expanded
          ORDER BY quote_id, COALESCE(parent_id, upgrade_id), pos ASC
        ),
        cleaned AS (
          SELECT quote_id,
                 array_agg(upgrade_id ORDER BY pos) AS new_ids
          FROM winners
          GROUP BY quote_id
        )
        UPDATE quotes q
        SET selected_upgrade_ids = c.new_ids
        FROM cleaned c
        WHERE q.id = c.quote_id
          AND q.selected_upgrade_ids <> c.new_ids
      `).then((r) => {
        if ((r as any).rowCount && (r as any).rowCount > 0) {
          log(`✅ Deduped variant upgrades on ${(r as any).rowCount} quotes`);
        }
      }).catch((err: Error) => {
        console.error("Quote upgrade dedupe backfill:", err.message);
      });
      // Rename all ATS- prefixed SKUs to MTV- (one-time idempotent migration)
      Promise.all([
        pool.query(`UPDATE kits SET sku = REPLACE(sku, 'ATS-', 'MTV-') WHERE sku LIKE 'ATS-%'`),
        pool.query(`UPDATE upgrades SET sku = REPLACE(sku, 'ATS-', 'MTV-') WHERE sku LIKE 'ATS-%'`),
        pool.query(`
          UPDATE kits
          SET sku_components = (
            SELECT jsonb_agg(
              CASE WHEN (elem->>'sku') LIKE 'ATS-%'
              THEN jsonb_set(elem, '{sku}', to_jsonb(REPLACE(elem->>'sku', 'ATS-', 'MTV-')))
              ELSE elem END
            )
            FROM jsonb_array_elements(sku_components) AS elem
          )
          WHERE sku_components IS NOT NULL AND sku_components::text LIKE '%ATS-%'
        `),
        pool.query(`
          UPDATE upgrades
          SET sku_components = (
            SELECT jsonb_agg(
              CASE WHEN (elem->>'sku') LIKE 'ATS-%'
              THEN jsonb_set(elem, '{sku}', to_jsonb(REPLACE(elem->>'sku', 'ATS-', 'MTV-')))
              ELSE elem END
            )
            FROM jsonb_array_elements(sku_components) AS elem
          )
          WHERE sku_components IS NOT NULL AND sku_components::text LIKE '%ATS-%'
        `),
      ])
        .then(results => {
          const [kits, upgrades, kitBom, upgradeBom] = results;
          const total = (kits.rowCount ?? 0) + (upgrades.rowCount ?? 0) + (kitBom.rowCount ?? 0) + (upgradeBom.rowCount ?? 0);
          if (total > 0) log(`✅ Renamed ATS- → MTV- on ${total} row(s)`);
        })
        .catch((err: Error) => console.error("SKU prefix migration:", err.message));
      // Add is_admin column to analytics_sessions if it doesn't exist yet (production safe)
      pool.query("ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE")
        .then(() => log("✅ Analytics admin filter column ready"))
        .catch((err: Error) => console.error("Analytics migration:", err.message));
      // Add spec approval columns to quotes if not present
      pool.query(`
        ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approval_token TEXT UNIQUE;
        ALTER TABLE quotes ADD COLUMN IF NOT EXISTS spec_approval_status TEXT;
        ALTER TABLE quotes ADD COLUMN IF NOT EXISTS spec_approval_comments TEXT;
      `)
        .then(() => log("✅ Spec approval columns ready"))
        .catch((err: Error) => console.error("Spec approval migration:", err.message));
      // Add custom_extras column to quotes (bespoke line items not in standard configurator)
      pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS custom_extras JSONB DEFAULT '[]'`)
        .then(() => log("✅ Custom extras column ready"))
        .catch((err) => log(`⚠️ Custom extras column error: ${err.message}`));

      pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vat_deferred BOOLEAN NOT NULL DEFAULT FALSE`)
        .then(() => log("✅ Quote VAT deferred column ready"))
        .catch((err: Error) => console.error("VAT deferred migration:", err.message));
      pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ai_session_id VARCHAR`)
        .then(() => log("✅ Quote AI session link column ready"))
        .catch((err: Error) => console.error("Quote AI session migration:", err.message));
      pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS staff_name TEXT`)
        .then(() => log("✅ Quote staff name column ready"))
        .catch((err: Error) => console.error("Quote staff name migration:", err.message));
      pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS choose_option_token TEXT`)
        .then(() => log("✅ Quote choose-option token column ready"))
        .catch((err: Error) => console.error("Quote choose-option token migration:", err.message));
      pool.query(`ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE`)
        .then(() => log("✅ Gallery featured column ready"))
        .catch((err: Error) => console.error("Gallery featured migration:", err.message));
      pool.query(`ALTER TABLE vans ADD COLUMN IF NOT EXISTS sale_status TEXT NOT NULL DEFAULT 'available'`)
        .then(() => log("✅ Van sale_status column ready"))
        .catch((err: Error) => console.error("Van sale_status migration:", err.message));
      pool.query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS author_bio TEXT`)
        .then(() => log("✅ Blog post author_bio column ready"))
        .catch((err: Error) => console.error("Blog post author_bio migration:", err.message));
      // Add quote_id column to leads for linking converted leads to their quote
      pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS quote_id VARCHAR REFERENCES quotes(id)`)
        .then(() => log("✅ Lead quote_id column ready"))
        .catch((err: Error) => console.error("Lead quote_id migration:", err.message));
      pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sage_invoice_id TEXT`)
        .then(() => log("✅ Sage invoice ID column ready"))
        .catch((err: Error) => console.error("Sage invoice_id migration:", err.message));
      pool.query(`
        ALTER TABLE quotes ADD COLUMN IF NOT EXISTS finance_notes TEXT;
        ALTER TABLE quotes ADD COLUMN IF NOT EXISTS finance_decision_at TIMESTAMPTZ;
      `)
        .then(() => log("✅ Finance portal columns ready"))
        .catch((err: Error) => console.error("Finance portal migration:", err.message));
      pool.query(`
        CREATE TABLE IF NOT EXISTS upgrade_categories (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        INSERT INTO upgrade_categories (id, label, sort_order) VALUES
          ('commercial',    'Commercial / Hybrid', 0),
          ('air-systems',   'Air Systems',         1),
          ('equipment',     'Equipment',           2),
          ('branding',      'Branding',            3),
          ('security',      'Security',            4),
          ('lighting',      'Lighting',            5),
          ('business',      'Business',            6),
          ('technology',    'Technology',          7),
          ('comfort',       'Comfort',             8),
          ('storage',       'Storage',             9),
          ('safety',        'Safety',              10),
          ('power',         'Power',               11),
          ('accessories',   'Accessories',         12),
          ('profit-makers', 'Profit Makers',       13)
        ON CONFLICT (id) DO NOTHING;
      `)
        .then(() => log("✅ Upgrade categories table ready"))
        .catch((err: Error) => console.error("Upgrade categories migration:", err.message));
      pool.query(`
        CREATE TABLE IF NOT EXISTS follow_ups (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          lead_id VARCHAR REFERENCES leads(id),
          quote_id VARCHAR REFERENCES quotes(id),
          customer_name TEXT NOT NULL,
          customer_phone TEXT,
          customer_email TEXT,
          scheduled_date TEXT NOT NULL,
          notes TEXT,
          assigned_to_user_id VARCHAR REFERENCES users(id),
          assigned_to_name TEXT,
          assigned_to_email TEXT,
          completed BOOLEAN NOT NULL DEFAULT FALSE,
          completed_at TIMESTAMP,
          reminder_sent_at TIMESTAMP,
          created_by TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
        .then(() => log("✅ Follow-ups table ready"))
        .catch((err: Error) => console.error("Follow-ups migration:", err.message));
      pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sage_pushed_at TIMESTAMP`)
        .then(() => log("✅ Sage pushed_at column ready"))
        .catch((err: Error) => console.error("Sage pushed_at migration:", err.message));
      pool.query(`
        ALTER TABLE quotes ADD COLUMN IF NOT EXISTS autotrade_pushes jsonb NOT NULL DEFAULT '[]'::jsonb;
        ALTER TABLE quotes ALTER COLUMN autotrade_pushes TYPE jsonb USING autotrade_pushes::jsonb;
      `)
        .then(() => log("✅ AutoTradeOS push history column ready"))
        .catch((err: Error) => console.error("AutoTradeOS push history migration:", err.message));
      // Create blog_posts table if not present
      pool.query(`
        CREATE TABLE IF NOT EXISTS ai_conversations (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id VARCHAR NOT NULL UNIQUE,
          status VARCHAR NOT NULL DEFAULT 'in_progress',
          messages JSON NOT NULL DEFAULT '[]',
          mapped_config JSON,
          contact_name VARCHAR,
          contact_phone VARCHAR,
          van_type VARCHAR,
          van_size VARCHAR,
          spec_level VARCHAR,
          finance_preference VARCHAR,
          includes_48v BOOLEAN NOT NULL DEFAULT FALSE,
          was_48v_pitched BOOLEAN NOT NULL DEFAULT FALSE,
          response_to_48v VARCHAR,
          suggested_upgrade_ids JSON NOT NULL DEFAULT '[]',
          added_upgrade_ids JSON NOT NULL DEFAULT '[]',
          config_completed BOOLEAN NOT NULL DEFAULT FALSE,
          marked_contacted BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP
        );
      `)
        .then(async () => {
          log("✅ AI conversations table ready");
          // Remove duplicate session_id rows (keep latest by created_at) so the
          // unique index can be created cleanly.
          await pool.query(`
            DELETE FROM ai_conversations
            WHERE id IN (
              SELECT id FROM (
                SELECT id,
                  ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at DESC NULLS LAST) AS rn
                FROM ai_conversations
              ) ranked
              WHERE rn > 1
            )
          `).catch((err: Error) => console.error("AI conversations dedup:", err.message));
          // Ensure unique constraint exists so ON CONFLICT (session_id) works
          await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS ai_conversations_session_id_unique
            ON ai_conversations (session_id)
          `)
            .then(() => log("✅ AI conversations session_id unique index ready"))
            .catch((err: Error) => console.error("AI conversations unique index:", err.message));
          // Add contacted_note column if it doesn't exist (added in task #46)
          await pool.query(`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS contacted_note TEXT`)
            .then(() => log("✅ AI conversations contacted_note column ready"))
            .catch((err: Error) => console.error("AI conversations contacted_note migration:", err.message));
        })
        .catch((err: Error) => console.error("AI conversations migration:", err.message));
      pool.query(`
        CREATE TABLE IF NOT EXISTS blog_posts (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          content TEXT NOT NULL,
          featured_image TEXT,
          category TEXT,
          tags JSON NOT NULL DEFAULT '[]',
          published BOOLEAN NOT NULL DEFAULT FALSE,
          published_at TIMESTAMP,
          seo_title TEXT,
          seo_description TEXT,
          author_name TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `)
        .then(() => log("✅ Blog posts table ready"))
        .catch((err: Error) => console.error("Blog migration:", err.message));
      // Create ai_packages table and seed Bronze/Silver/Gold defaults
      pool.query(`
        CREATE TABLE IF NOT EXISTS ai_packages (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(50) NOT NULL,
          tier INTEGER NOT NULL,
          description TEXT,
          recommended_for TEXT,
          upgrade_ids JSONB NOT NULL DEFAULT '[]',
          active BOOLEAN NOT NULL DEFAULT TRUE
        );
        INSERT INTO ai_packages (id, name, tier, description, recommended_for, upgrade_ids) VALUES
          ('bronze', 'Bronze', 1,
           'Essential starter package with everything you need to get up and running professionally.',
           'Budget-conscious, just starting out, or lower volume (under 15 jobs per day).',
           '["light-pack-standard","standard-reversing-camera","accessories-pack-1"]'::jsonb),
          ('silver', 'Silver', 2,
           'Our most popular mid-spec package — the right balance of capability and cost.',
           'Growing operations, 10–20 jobs per day, or those wanting a professional setup without going full premium.',
           '["light-pack-upgraded","front-facing-dash-camera","standard-reversing-camera","accessories-pack-2","vehicle-tracker"]'::jsonb),
          ('gold', 'Gold', 3,
           'Full-spec premium package — everything you need to run a high-volume, professional mobile tyre operation.',
           'High-volume operators (20+ jobs per day), fleet expansions, or those wanting maximum capability from day one.',
           '["light-pack-upgraded","van-cctv-system","apple-carplay","accessories-pack-3","vehicle-tracker","vehicle-immobiliser"]'::jsonb)
        ON CONFLICT (id) DO NOTHING;
      `)
        .then(() => log("✅ AI packages table ready"))
        .catch((err: Error) => console.error("AI packages migration:", err.message));
      // Create testimonials table and seed initial records
      pool.query(`
        CREATE TABLE IF NOT EXISTS testimonials (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          company TEXT NOT NULL,
          location TEXT,
          content TEXT NOT NULL,
          rating INTEGER NOT NULL DEFAULT 5,
          sort_order INTEGER NOT NULL DEFAULT 0,
          published BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW()
        );
        INSERT INTO testimonials (id, name, company, location, content, rating, sort_order, published) VALUES
          ('seed-testimonial-001', 'James Mitchell', 'Mobile Tyre Solutions Ltd', NULL, 'Outstanding service and quality. The van conversion exceeded our expectations and we were earning from day one.', 5, 0, TRUE),
          ('seed-testimonial-002', 'Sarah Williams', 'TyreFix Mobile', NULL, 'Professional setup, great finance options, and excellent ongoing support. Highly recommend for anyone starting out.', 5, 1, TRUE),
          ('seed-testimonial-003', 'David Thompson', 'Thompson Tyres', NULL, 'Quality equipment and van conversion. The team guided us through every step of the process.', 5, 2, TRUE)
        ON CONFLICT (id) DO NOTHING;
      `)
        .then(() => log("✅ Testimonials table ready"))
        .catch((err: Error) => console.error("Testimonials migration:", err.message));

      // ── CRM Customers tables & FK columns ───────────────────────────────────
      // Create customers table first (so FK columns on other tables can reference it)
      pool.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          company TEXT,
          primary_staff_id VARCHAR,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (email);
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);
      `)
        .then(async () => {
          log("✅ Customers table ready");
          // customer_notes table
          await pool.query(`
            CREATE TABLE IF NOT EXISTS customer_notes (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              customer_id VARCHAR NOT NULL REFERENCES customers(id),
              author_id VARCHAR,
              author_name TEXT,
              note_type TEXT NOT NULL DEFAULT 'general',
              text TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes (customer_id);
          `).then(() => log("✅ Customer notes table ready"))
            .catch((err: Error) => console.error("Customer notes migration:", err.message));
          // Add soft-delete column to customers
          pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`)
            .catch((err: Error) => console.error("Customer deleted_at migration:", err.message));

          // Add customer_id FK columns to leads, quotes, ai_conversations
          // Also add FK constraints for primary_staff_id (→ users) and customer_notes.author_id (→ users) if users table exists
          await pool.query(`
            ALTER TABLE leads ADD COLUMN IF NOT EXISTS customer_id VARCHAR REFERENCES customers(id);
            ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_id VARCHAR REFERENCES customers(id);
            ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS customer_id VARCHAR REFERENCES customers(id);
          `).then(() => log("✅ Customer FK columns ready"))
            .catch((err: Error) => console.error("Customer FK columns migration:", err.message));

          // FK constraints for staff columns (best-effort — won't fail if users table doesn't exist yet)
          await pool.query(`
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
                BEGIN
                  ALTER TABLE customers
                    ADD CONSTRAINT fk_customers_primary_staff FOREIGN KEY (primary_staff_id) REFERENCES users(id) ON DELETE SET NULL;
                EXCEPTION WHEN duplicate_object THEN NULL;
                END;
                BEGIN
                  ALTER TABLE customer_notes
                    ADD CONSTRAINT fk_customer_notes_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
                EXCEPTION WHEN duplicate_object THEN NULL;
                END;
              END IF;
            END $$;
          `).then(() => log("✅ Customer staff FK constraints ready"))
            .catch((err: Error) => console.error("Customer staff FK migration:", err.message));
          // Add status_changed_at to leads
          await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP`)
            .then(() => log("✅ Lead status_changed_at column ready"))
            .catch((err: Error) => console.error("Lead status_changed_at migration:", err.message));

          // Add previous_customer_name, previous_customer_id and reassigned_at for full reassignment audit trail
          // Split into individual queries — node-postgres multi-statement batches can silently skip statements
          await Promise.all([
            pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS previous_customer_name VARCHAR`),
            pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS previous_customer_id VARCHAR`),
            pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP`),
            pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS previous_customer_name VARCHAR`),
            pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS previous_customer_id VARCHAR`),
            pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP`),
            pool.query(`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS previous_customer_name VARCHAR`),
            pool.query(`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS previous_customer_id VARCHAR`),
            pool.query(`ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP`),
          ]).then(() => log("✅ Reassignment audit columns ready"))
            .catch((err: Error) => console.error("Reassignment audit migration:", err.message));

          // Add reassignment_history JSONB column for full multi-hop audit chain
          await pool.query(`
            ALTER TABLE leads ADD COLUMN IF NOT EXISTS reassignment_history JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reassignment_history JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS reassignment_history JSONB NOT NULL DEFAULT '[]'::jsonb;
          `).then(() => log("✅ Reassignment history columns ready"))
            .catch((err: Error) => console.error("Reassignment history migration:", err.message));

          // Backfill reassignment_history from single-column data for existing records
          await pool.query(`
            UPDATE leads SET reassignment_history = jsonb_build_array(jsonb_build_object(
              'fromCustomerName', previous_customer_name,
              'fromCustomerId', previous_customer_id,
              'toCustomerName', (SELECT name FROM customers WHERE id = leads.customer_id),
              'toCustomerId', leads.customer_id,
              'reassignedAt', to_char(reassigned_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            ))
            WHERE previous_customer_id IS NOT NULL
              AND reassigned_at IS NOT NULL
              AND reassignment_history = '[]'::jsonb;

            UPDATE quotes SET reassignment_history = jsonb_build_array(jsonb_build_object(
              'fromCustomerName', previous_customer_name,
              'fromCustomerId', previous_customer_id,
              'toCustomerName', (SELECT name FROM customers WHERE id = quotes.customer_id),
              'toCustomerId', quotes.customer_id,
              'reassignedAt', to_char(reassigned_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            ))
            WHERE previous_customer_id IS NOT NULL
              AND reassigned_at IS NOT NULL
              AND reassignment_history = '[]'::jsonb;

            UPDATE ai_conversations SET reassignment_history = jsonb_build_array(jsonb_build_object(
              'fromCustomerName', previous_customer_name,
              'fromCustomerId', previous_customer_id,
              'toCustomerName', (SELECT name FROM customers WHERE id = ai_conversations.customer_id),
              'toCustomerId', ai_conversations.customer_id,
              'reassignedAt', to_char(reassigned_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            ))
            WHERE previous_customer_id IS NOT NULL
              AND reassigned_at IS NOT NULL
              AND reassignment_history = '[]'::jsonb;
          `).then(() => log("✅ Reassignment history backfill complete"))
            .catch((err: Error) => console.error("Reassignment history backfill:", err.message));

          // Unique partial indexes on customers.email and customers.phone to prevent
          // future duplicate records at the DB level. Only active (non-deleted) customers
          // are included in the uniqueness constraint. Recreate if old indexes exist without
          // the deleted_at IS NULL condition.
          await (async () => {
            try {
              const dupCheck = await pool.query<{ email_dups: string; phone_dups: string }>(`
                SELECT
                  (SELECT COUNT(*) FROM (
                    SELECT email FROM customers
                    WHERE email IS NOT NULL AND email != '' AND deleted_at IS NULL
                    GROUP BY email HAVING COUNT(*) > 1
                  ) e) AS email_dups,
                  (SELECT COUNT(*) FROM (
                    SELECT phone FROM customers
                    WHERE phone IS NOT NULL AND phone != '' AND deleted_at IS NULL
                    GROUP BY phone HAVING COUNT(*) > 1
                  ) p) AS phone_dups
              `);
              const { email_dups, phone_dups } = dupCheck.rows[0];
              if (Number(email_dups) > 0 || Number(phone_dups) > 0) {
                console.warn(
                  `⚠️  Skipping customer unique index creation: ` +
                  `${email_dups} email duplicate group(s) and ` +
                  `${phone_dups} phone duplicate group(s) still exist. ` +
                  `Run POST /api/admin/customers/deduplicate to clean up, then indexes will be applied.`
                );
                return;
              }
              // Drop old indexes that don't include deleted_at IS NULL, then recreate correctly.
              await pool.query(`
                DROP INDEX IF EXISTS idx_customers_email_unique;
                DROP INDEX IF EXISTS idx_customers_phone_unique;
                CREATE UNIQUE INDEX idx_customers_email_unique
                  ON customers (email)
                  WHERE email IS NOT NULL AND email != '' AND deleted_at IS NULL;
                CREATE UNIQUE INDEX idx_customers_phone_unique
                  ON customers (phone)
                  WHERE phone IS NOT NULL AND phone != '' AND deleted_at IS NULL;
              `);
              log("✅ Customer unique indexes ready");
            } catch (err: unknown) {
              console.error("Customer unique indexes migration:", err instanceof Error ? err.message : err);
            }
          })();

          // Merge history table — tracks every mergeCustomers() call so staff can undo merges.
          await pool.query(`
            CREATE TABLE IF NOT EXISTS customer_merge_history (
              id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
              keep_id VARCHAR NOT NULL,
              keep_snapshot_name TEXT,
              keep_snapshot_email TEXT,
              keep_snapshot_phone TEXT,
              keep_snapshot_company TEXT,
              removed_id VARCHAR NOT NULL,
              removed_snapshot_name TEXT,
              removed_snapshot_email TEXT,
              removed_snapshot_phone TEXT,
              removed_snapshot_company TEXT,
              leads_relinked JSONB NOT NULL DEFAULT '[]',
              quotes_relinked JSONB NOT NULL DEFAULT '[]',
              conversations_relinked JSONB NOT NULL DEFAULT '[]',
              notes_relinked JSONB NOT NULL DEFAULT '[]',
              merged_at TIMESTAMP DEFAULT NOW(),
              split_at TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_merge_history_keep ON customer_merge_history (keep_id);
            CREATE INDEX IF NOT EXISTS idx_merge_history_merged_at ON customer_merge_history (merged_at);
            ALTER TABLE customer_merge_history ADD COLUMN IF NOT EXISTS triggered_by VARCHAR;
            ALTER TABLE customer_merge_history ADD COLUMN IF NOT EXISTS split_by VARCHAR;
          `).then(() => log("✅ Customer merge history table ready"))
            .catch((err: Error) => console.error("Customer merge history migration:", err.message));

          pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_tab VARCHAR DEFAULT 'overview'`)
            .then(() => log("✅ User dashboard tab preference column ready"))
            .catch((err: Error) => console.error("User dashboard_tab migration:", err.message));

          // ── SKU / BOM columns for kits and upgrades (AutoTradeOS) ─────────
          Promise.all([
            pool.query(`ALTER TABLE kits ADD COLUMN IF NOT EXISTS sku TEXT`),
            pool.query(`ALTER TABLE kits ADD COLUMN IF NOT EXISTS sku_components JSONB`),
            pool.query(`ALTER TABLE upgrades ADD COLUMN IF NOT EXISTS sku TEXT`),
            pool.query(`ALTER TABLE upgrades ADD COLUMN IF NOT EXISTS sku_components JSONB`),
          ])
            .then(() => log("✅ SKU/BOM columns ready"))
            .catch((err: Error) => console.error("SKU/BOM migration:", err.message));

          // ── Cost price columns for kits and upgrades ──────────────────────
          Promise.all([
            pool.query(`ALTER TABLE kits ADD COLUMN IF NOT EXISTS cost_price INTEGER`),
            pool.query(`ALTER TABLE upgrades ADD COLUMN IF NOT EXISTS cost_price INTEGER`),
          ])
            .then(() => log("✅ Cost price columns ready"))
            .catch((err: Error) => console.error("Cost price migration:", err.message));

          // ── WrapGen artwork approval columns ──────────────────────────────
          Promise.all([
            pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS wrapgen_preview_id TEXT`),
            pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS wrapgen_preview_url TEXT`),
            pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS wrapgen_proof_sent_at TIMESTAMPTZ`),
            pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_approved_at TIMESTAMPTZ`),
            pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS artwork_approved_by TEXT`),
          ])
            .then(() => log("✅ WrapGen artwork columns ready"))
            .catch((err: Error) => console.error("WrapGen migration:", err.message));

          // ── Pipeline wallboard: target completion date ─────────────────────
          pool.query(`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS target_completion_date TIMESTAMP`)
            .then(() => log("✅ target_completion_date column ready"))
            .catch((err: Error) => console.error("target_completion_date migration:", err.message));

          // ── Vans: expected arrival date (for admin calendar) ───────────────
          pool.query(`ALTER TABLE vans ADD COLUMN IF NOT EXISTS expected_arrival_date TIMESTAMP`)
            .then(() => log("✅ vans.expected_arrival_date column ready"))
            .catch((err: Error) => console.error("expected_arrival_date migration:", err.message));

          // Headline machines on kits — short labels shown as "Includes:"
          // sub-line on the build sheet and kiosk so the workshop can see the
          // headline machines in each pack at a glance (without scanning BOM).
          pool.query(`ALTER TABLE kits ADD COLUMN IF NOT EXISTS headline_machines TEXT[]`)
            .then(() => log("✅ kits.headline_machines column ready"))
            .catch((err: Error) => console.error("headline_machines migration:", err.message));

          // ── WrapGen auto-link tokens ───────────────────────────────────────
          pool.query(`
            CREATE TABLE IF NOT EXISTS wrapgen_link_tokens (
              token      TEXT        PRIMARY KEY,
              quote_id   TEXT        NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              expires_at TIMESTAMPTZ NOT NULL,
              used_at    TIMESTAMPTZ
            )
          `)
            .then(() => log("✅ WrapGen link tokens table ready"))
            .catch((err: Error) => console.error("WrapGen link tokens migration:", err.message));

          // ── Mutual exclusivity: Silent Compressor (48V) vs Commercial Power Inversion ──
          // These two upgrades serve overlapping electrical/power roles and must not
          // both be selectable. We assign them the same exclusive_group so the
          // configurator's existing group-enforcement logic handles deselection.
          // Matches by ID for the known seed upgrade and by name pattern for any
          // production-only variants (e.g. "Commercial Power Inversion Systems").
          pool.query(`
            UPDATE upgrades
            SET exclusive_group = 'compressor-power-system'
            WHERE id = 'silent-compressor-upgrade'
               OR LOWER(name) LIKE '%commercial power inversion%'
               OR LOWER(name) LIKE '%power inversion system%'
          `)
            .then(r => log(`✅ Compressor/power-inversion exclusive group set (${r.rowCount} row(s))`))
            .catch((err: Error) => console.error("Compressor exclusive group migration:", err.message));

          // ── Mutual exclusivity: 48V Power System vs Lithium Battery Upgrade ──
          // The customer must pick one OR the other, never both. We assign both
          // upgrades (parent rows and all their variants share the same `name`)
          // the same exclusive_group so the configurator's existing group logic
          // deselects the other when one is chosen. Matching by name keeps this
          // correct across environments and overrides any earlier manual values
          // (the 48V system previously sat in the 'air-systems' group and the
          // Lithium upgrade had a stray free-text group). The 12hp commercial
          // compressor is intentionally left independent and can be chosen with
          // either.
          pool.query(`
            UPDATE upgrades
            SET exclusive_group = '48v-lithium-power'
            WHERE LOWER(name) LIKE '%48v power system%'
               OR LOWER(name) LIKE '%lithium battery%'
          `)
            .then(r => log(`✅ 48V/Lithium exclusive group set (${r.rowCount} row(s))`))
            .catch((err: Error) => console.error("48V/Lithium exclusive group migration:", err.message));

          // ── Backfill: link existing leads/quotes/ai_conversations to customers ──
          // Uses email-first, phone-fallback precedence to avoid cross-matching
          (async () => {
            // Helper: find active (non-deleted) customer by email first, then phone
            async function findCustomerByEmailThenPhone(email: string | null, phone: string | null): Promise<string | null> {
              if (email) {
                const { rows } = await pool.query(`SELECT id FROM customers WHERE email = $1 AND deleted_at IS NULL LIMIT 1`, [email]);
                if (rows.length > 0) return rows[0].id;
              }
              if (phone) {
                const { rows } = await pool.query(`SELECT id FROM customers WHERE phone = $1 AND deleted_at IS NULL LIMIT 1`, [phone]);
                if (rows.length > 0) return rows[0].id;
              }
              return null;
            }

            try {
              // Backfill from leads (email or phone required)
              const leadsToLink = await pool.query(`
                SELECT id, name, email, phone FROM leads
                WHERE customer_id IS NULL AND (email IS NOT NULL OR phone IS NOT NULL)
              `);
              for (const row of leadsToLink.rows) {
                try {
                  const found = await findCustomerByEmailThenPhone(row.email ?? null, row.phone ?? null);
                  let customerId = found;
                  if (!customerId) {
                    const ins = await pool.query(
                      `INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
                      [row.name || "Unknown", row.email ?? null, row.phone ?? null]
                    );
                    customerId = ins.rows[0].id;
                  }
                  await pool.query(`UPDATE leads SET customer_id = $1 WHERE id = $2`, [customerId, row.id]);
                } catch { /* skip individual row errors */ }
              }
              // Backfill from quotes — includes name-only quotes (no email/phone)
              const quotesToLink = await pool.query(`
                SELECT id, user_name, email, phone FROM quotes
                WHERE customer_id IS NULL
              `);
              for (const row of quotesToLink.rows) {
                try {
                  const found = await findCustomerByEmailThenPhone(row.email ?? null, row.phone ?? null);
                  let customerId = found;
                  if (!customerId) {
                    const ins = await pool.query(
                      `INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
                      [row.user_name || "Unknown", row.email ?? null, row.phone ?? null]
                    );
                    customerId = ins.rows[0].id;
                  }
                  await pool.query(`UPDATE quotes SET customer_id = $1 WHERE id = $2`, [customerId, row.id]);
                } catch { /* skip individual row errors */ }
              }
              // Backfill from ai_conversations (email or phone required via mapped_config)
              const convosToLink = await pool.query(`
                SELECT id, session_id, mapped_config FROM ai_conversations
                WHERE customer_id IS NULL AND mapped_config IS NOT NULL
              `);
              for (const row of convosToLink.rows) {
                try {
                  const cfg = typeof row.mapped_config === "string" ? JSON.parse(row.mapped_config) : (row.mapped_config ?? {});
                  const cfgEmail = (cfg.contactEmail ?? "").trim() || null;
                  const cfgPhone = (cfg.contactPhone ?? "").trim() || null;
                  const cfgName = (cfg.contactName ?? "AI Chat Contact").trim();
                  if (!cfgEmail && !cfgPhone) continue;
                  const found = await findCustomerByEmailThenPhone(cfgEmail, cfgPhone);
                  let customerId = found;
                  if (!customerId) {
                    const ins = await pool.query(
                      `INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
                      [cfgName, cfgEmail, cfgPhone]
                    );
                    customerId = ins.rows[0].id;
                  }
                  await pool.query(`UPDATE ai_conversations SET customer_id = $1 WHERE id = $2`, [customerId, row.id]);
                } catch { /* skip individual row errors */ }
              }
              log("✅ Customer backfill complete");
            } catch (err: any) {
              console.error("Customer backfill error:", err?.message);
            }
          })();
        })
        .catch((err: Error) => console.error("Customers migration:", err.message));

      // Artwork proofs table
      pool.query(`
        CREATE TABLE IF NOT EXISTS artwork_proofs (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          customer_id VARCHAR NOT NULL,
          quote_id VARCHAR,
          uploaded_by_id VARCHAR,
          files JSONB NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'pending_review',
          token VARCHAR NOT NULL UNIQUE,
          admin_notes TEXT,
          customer_notes TEXT,
          sent_at TIMESTAMP,
          responded_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_artwork_proofs_customer ON artwork_proofs (customer_id);
        CREATE INDEX IF NOT EXISTS idx_artwork_proofs_token ON artwork_proofs (token);
      `).then(() => {
        // Add FK constraints idempotently (separate statement — constraints cannot be added with IF NOT EXISTS directly)
        pool.query(`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE constraint_name = 'artwork_proofs_customer_id_fkey'
                AND table_name = 'artwork_proofs'
            ) THEN
              ALTER TABLE artwork_proofs
                ADD CONSTRAINT artwork_proofs_customer_id_fkey
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
            END IF;
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE constraint_name = 'artwork_proofs_quote_id_fkey'
                AND table_name = 'artwork_proofs'
            ) THEN
              ALTER TABLE artwork_proofs
                ADD CONSTRAINT artwork_proofs_quote_id_fkey
                FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE constraint_name = 'artwork_proofs_uploaded_by_id_fkey'
                AND table_name = 'artwork_proofs'
            ) THEN
              ALTER TABLE artwork_proofs
                ADD CONSTRAINT artwork_proofs_uploaded_by_id_fkey
                FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
          END $$;
        `).then(() => log("✅ Artwork proofs table ready"))
          .catch((err: Error) => console.error("Artwork proofs FK migration:", err.message));
      })
        .catch((err: Error) => console.error("Artwork proofs migration:", err.message));

      // Artwork proof messages table
      pool.query(`
        CREATE TABLE IF NOT EXISTS artwork_proof_messages (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          proof_id VARCHAR NOT NULL REFERENCES artwork_proofs(id) ON DELETE CASCADE,
          sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'customer')),
          sender_name TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_artwork_proof_messages_proof ON artwork_proof_messages (proof_id);
      `).then(() => log("✅ Artwork proof messages table ready"))
        .catch((err: Error) => console.error("Artwork proof messages migration:", err.message));

      // Staff phone numbers table (for Twilio click-to-call bridging)
      // Global list managed by full admins. sort_order column added idempotently.
      pool.query(`
        CREATE TABLE IF NOT EXISTS staff_phone_numbers (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          label TEXT NOT NULL DEFAULT 'Mobile',
          phone TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
        ALTER TABLE staff_phone_numbers ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
      `).then(() => log("✅ Staff phone numbers table ready"))
        .catch((err: Error) => console.error("Staff phone numbers migration:", err.message));

      // SKU stock levels table (populated by AutoTradeOS webhook)
      pool.query(`
        CREATE TABLE IF NOT EXISTS sku_stock_levels (
          sku TEXT PRIMARY KEY,
          stock_qty INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `).then(() => log("✅ SKU stock levels table ready"))
        .catch((err: Error) => console.error("SKU stock levels migration:", err.message));

      // Stock tracking tables (for BOM QR scan deduction workflow)
      pool.query(`
        CREATE TABLE IF NOT EXISTS stock_items (
          sku TEXT PRIMARY KEY,
          description TEXT NOT NULL DEFAULT '',
          on_hand INTEGER NOT NULL DEFAULT 0,
          low_stock_threshold INTEGER,
          updated_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS stock_deductions (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          sku TEXT NOT NULL,
          quantity_deducted INTEGER NOT NULL,
          quote_id VARCHAR REFERENCES quotes(id),
          build_sheet_ref TEXT NOT NULL DEFAULT '',
          scanned_by_session TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_stock_deductions_sku ON stock_deductions (sku);
        CREATE INDEX IF NOT EXISTS idx_stock_deductions_quote ON stock_deductions (quote_id);
      `).then(() => log("✅ Stock tracking tables ready"))
        .then(() => pool.query(`
          ALTER TABLE stock_deductions ADD COLUMN IF NOT EXISTS kit_id VARCHAR;
          ALTER TABLE stock_deductions ADD COLUMN IF NOT EXISTS upgrade_id VARCHAR;
        `)).then(() => log("✅ stock_deductions audit columns ready"))
        .catch((err: Error) => console.error("Stock tables migration:", err.message));

      // BOM sync history log table — capped to most recent 50 entries via trigger
      pool.query(`
        CREATE TABLE IF NOT EXISTS bom_sync_log (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
          skus_imported INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_bom_sync_log_synced_at ON bom_sync_log (synced_at DESC);
      `).then(() => log("✅ BOM sync log table ready"))
        .catch((err: Error) => console.error("BOM sync log migration:", err.message));

      pool.query(`ALTER TABLE bom_sync_log ADD COLUMN IF NOT EXISTS triggered_by TEXT`)
        .then(() => log("✅ bom_sync_log.triggered_by column ready"))
        .catch((err: Error) => console.error("BOM sync log triggered_by migration:", err.message));

      pool.query(`ALTER TABLE bom_sync_log ADD COLUMN IF NOT EXISTS error_message TEXT`)
        .then(() => log("✅ bom_sync_log.error_message column ready"))
        .catch((err: Error) => console.error("BOM sync log error_message migration:", err.message));

      // Backfill: reprice existing £0 Max AI quotes and create missing draft quotes
      // for any completed conversations. Runs as a proper async function so we can do
      // JS-side price calculations with kit+upgrade DB lookups.
      (async () => {
        try {
          // ── Step 1: Reprice quotes that already exist but have est_total = 0 ──
          // These were auto-created before the kitId was captured in the conversation.
          const zeroPriced = await pool.query(`
            SELECT q.id, ac.mapped_config
            FROM quotes q
            JOIN ai_conversations ac ON ac.session_id = q.ai_session_id
            WHERE q.est_total = 0
              AND q.ai_session_id IS NOT NULL
              AND ac.mapped_config IS NOT NULL
          `);

          let repriced = 0;
          for (const row of zeroPriced.rows) {
            const cfg = typeof row.mapped_config === 'string'
              ? JSON.parse(row.mapped_config)
              : (row.mapped_config ?? {});
            const kitId: string | null = cfg.kitId ?? null;
            const upgradeIds: string[] = Array.isArray(cfg.upgradeIds) ? cfg.upgradeIds : [];

            let kitPrice = 0;
            if (kitId) {
              const kr = await pool.query(`SELECT price FROM kits WHERE id = $1 LIMIT 1`, [kitId]);
              kitPrice = kr.rows[0]?.price ?? 0;
            }
            let upgradesPrice = 0;
            if (upgradeIds.length > 0) {
              const ur = await pool.query(
                `SELECT COALESCE(SUM(price),0) AS total FROM upgrades WHERE id = ANY($1::text[])`,
                [upgradeIds]
              );
              upgradesPrice = parseInt(ur.rows[0]?.total ?? '0', 10);
            }

            const subtotal = kitPrice + upgradesPrice;
            if (subtotal === 0) continue; // still no pricing data — skip

            const vat = Math.round(subtotal * 0.2);
            const total = subtotal + vat;
            await pool.query(
              `UPDATE quotes SET kit_id=$1, selected_upgrade_ids=$2, est_subtotal=$3, est_vat=$4, est_total=$5 WHERE id=$6`,
              [kitId, JSON.stringify(upgradeIds), subtotal, vat, total, row.id]
            );
            repriced++;
          }
          if (repriced > 0) log(`✅ Repriced ${repriced} Max AI quote(s) from £0 to correct values`);

          // ── Step 2: Create draft quotes for completed conversations with no quote yet ──
          const missing = await pool.query(`
            SELECT ac.session_id, ac.contact_name, ac.contact_phone, ac.van_type, ac.van_size, ac.mapped_config
            FROM ai_conversations ac
            WHERE ac.config_completed = TRUE
              AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.ai_session_id = ac.session_id)
          `);

          let created = 0;
          for (const ac of missing.rows) {
            const cfg = typeof ac.mapped_config === 'string'
              ? JSON.parse(ac.mapped_config)
              : (ac.mapped_config ?? {});
            const kitId: string | null = cfg.kitId ?? null;
            const upgradeIds: string[] = Array.isArray(cfg.upgradeIds) ? cfg.upgradeIds : [];

            let kitPrice = 0;
            if (kitId) {
              const kr = await pool.query(`SELECT price FROM kits WHERE id = $1 LIMIT 1`, [kitId]);
              kitPrice = kr.rows[0]?.price ?? 0;
            }
            let upgradesPrice = 0;
            if (upgradeIds.length > 0) {
              const ur = await pool.query(
                `SELECT COALESCE(SUM(price),0) AS total FROM upgrades WHERE id = ANY($1::text[])`,
                [upgradeIds]
              );
              upgradesPrice = parseInt(ur.rows[0]?.total ?? '0', 10);
            }
            const subtotal = kitPrice + upgradesPrice;
            const vat = Math.round(subtotal * 0.2);
            const total = subtotal + vat;

            const autoName = (ac.contact_name ?? '').trim() || 'Via Max (name pending)';
            const autoPhone = (ac.contact_phone ?? '').trim();
            const customVanDescription =
              cfg.ownVan === false && ac.van_size
                ? `${ac.van_size} van supplied by Mobile Tyre Vans`
                : cfg.ownVan === true
                ? "Customer's own van"
                : null;

            await pool.query(
              `INSERT INTO quotes (
                user_name, email, phone, service_type, kit_id,
                selected_upgrade_ids, selected_upgrades, training_option_ids,
                finance_plan_id, custom_van_description,
                est_subtotal, est_vat, est_total, est_discount,
                ai_session_id, status, admin_notes_history
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
              [
                autoName, '', autoPhone,
                cfg.serviceType ?? null,
                kitId,
                JSON.stringify(upgradeIds),
                JSON.stringify({}),
                JSON.stringify([]),
                cfg.financePlanId ?? null,
                customVanDescription,
                subtotal, vat, total, 0,
                ac.session_id,
                'new',
                JSON.stringify([{
                  text: 'Auto-created from Max AI chat — customer completed the configuration but may not have submitted the quote form. Phone number captured from Max chat.',
                  timestamp: new Date().toISOString(),
                  author: 'System',
                }]),
              ]
            );
            created++;
          }
          if (created > 0) log(`✅ Backfilled ${created} draft quote(s) from completed Max conversations`);
        } catch (err: any) {
          console.error('Max AI backfill error:', err.message);
        }
      })();
    });
  });
})();
