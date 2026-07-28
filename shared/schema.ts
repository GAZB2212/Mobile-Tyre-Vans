import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, decimal, json, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Admin role types
export const adminRoles = ["none", "basic", "full", "finance"] as const;

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  passwordHash: varchar("password_hash").notNull(),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  adminRole: text("admin_role").notNull().default("none"), // "none", "basic", or "full"
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  dashboardTab: varchar("dashboard_tab").default("overview"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Van sale state — manual (staff-set) or auto-derived from a linked quote.
// Ranked available < deposit_taken < sold so the effective state can be the
// "highest" of the manual and auto values.
export const vanSaleStatuses = ["available", "deposit_taken", "sold"] as const;
export type VanSaleStatus = typeof vanSaleStatuses[number];

export const vans = pgTable("vans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  reg: text("reg"), // Vehicle registration plate
  title: text("title").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  year: integer("year").notNull(),
  mileage: integer("mileage").notNull(),
  price: integer("price").notNull(), // in pence
  vatIncluded: boolean("vat_included").notNull().default(false),
  euroStatus: text("euro_status"), // e.g., "Euro 6", "Euro 5", "Euro 4"
  specs: json("specs").$type<{
    transmission: string;
    size: string;
    fuel: string;
    doors?: number;
    engine?: string;
  }>().notNull(),
  images: json("images").$type<string[]>().notNull().default([]),
  heroImage: text("hero_image"),
  description: text("description"),
  urgencyBadge: text("urgency_badge"), // e.g. "Only 1 Left", "Just In", "Hot Deal", "Selling Fast"
  // Sale state set manually by staff. Auto-derived state from a linked quote
  // (deposit taken / in build) is computed on read and never written here, so
  // a manual mark and an automatic mark stay independent.
  saleStatus: text("sale_status").$type<VanSaleStatus>().notNull().default("available"),
  expectedArrivalDate: timestamp("expected_arrival_date"), // Date this van is expected to arrive at the workshop from the supplier — shown on the admin calendar
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  published: boolean("published").notNull().default(true),
});

export const kitServiceTypes = ["car", "commercial", "hybrid"] as const;
export type KitServiceType = typeof kitServiceTypes[number];

// SKU component type — used for bill-of-materials on kits and upgrades
export type SkuComponent = { sku: string; description: string; quantity: number; costPrice?: number | null };

export const kits = pgTable("kits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  includes: json("includes").$type<string[]>().notNull().default([]),
  powerKw: decimal("power_kw").notNull(),
  price: integer("price").notNull(), // in pence
  costPrice: integer("cost_price"), // cost price in pence, ex-VAT (nullable)
  euroSixCompatible: boolean("euro_six_compatible").notNull().default(false), // True for Euro 6 compatible kits
  serviceType: json("service_type").$type<KitServiceType[]>().notNull().default(["car", "commercial", "hybrid"]), // array of applicable service types; all 3 = show to everyone
  images: json("images").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  sku: text("sku"), // AutoTradeOS stock-keeping unit
  skuComponents: json("sku_components").$type<SkuComponent[]>(), // Bill of materials for composite products
  // Headline machines included in the pack — short labels (e.g. "Tyre Changer",
  // "Wheel Balancer", "Silent Compressor") shown as an "Includes:" sub-line
  // on the build sheet and kiosk so the workshop can see at a glance which
  // headline machines the pack contains without scanning the full BOM.
  headlineMachines: text("headline_machines").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  published: boolean("published").notNull().default(true),
});

// Upgrade categories enum
export const upgradeCategories = [
  "commercial",
  "air-systems",
  "equipment", 
  "branding",
  "security",
  "lighting",
  "business",
  "technology",
  "comfort",
  "storage",
  "safety",
  "power",
  "accessories",
  "profit-makers"
] as const;

// Quote status enums
export const quoteStatuses = [
  "new",              // Customer submitted, not yet called
  "contacted",        // Staff called and went through configurator
  "awaiting_deposit", // Customer happy, waiting for deposit payment
  "awaiting_finance",   // Sent to finance company, awaiting decision
  "finance_declined",   // Finance company declined the application
  "deposit_taken",      // Deposit received — ready for build
  "finance_approved",   // Finance company approved — ready for build
  "in_build",         // Build underway, build sheet generated
  "in_workshop",      // Van physically in the workshop right now
  "completed",        // Van built and delivered
  "cancelled",        // Cancelled
] as const;
export const buildStages = ["graphics", "electrical_systems", "accessories", "emergency_lighting", "tyre_equipment", "final_checks", "valet"] as const;
export const financeStatuses = ["pending", "approved", "declined", "more_info_needed"] as const;
export const discountTypes = ["percentage", "fixed"] as const;

export const upgrades = pgTable("upgrades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  detailedInfo: text("detailed_info"), // Extended information shown in "More Info" modal
  price: integer("price").notNull(), // in pence
  costPrice: integer("cost_price"), // cost price in pence, ex-VAT (nullable)
  images: json("images").$type<string[]>().notNull().default([]),
  videoUrl: text("video_url"), // YouTube, Vimeo, or direct video URL
  showVideo: boolean("show_video").notNull().default(false), // Toggle to show/hide video in More Info modal
  parentId: varchar("parent_id").references((): any => upgrades.id),
  variantName: text("variant_name"), // e.g., "Pack 1", "Pack 2", "Standard", "Premium"
  allowQuantity: boolean("allow_quantity").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  popular: boolean("popular").notNull().default(false), // Mark as popular upgrade
  forCommercial: boolean("for_commercial").notNull().default(false), // If true, shown only to commercial/hybrid customers
  carOnly: boolean("car_only").notNull().default(false), // If true, hidden from commercial customers (car/van only)
  hideForHybrid: boolean("hide_for_hybrid").notNull().default(false), // If true, hidden from hybrid customers (but still shown to commercial)
  supersedesKitItems: json("supersedes_kit_items").$type<string[]>().notNull().default([]), // Kit item strings this upgrade replaces/removes in the build sheet
  exclusiveGroup: text("exclusive_group"), // If set, only one upgrade in this group can be selected at a time
  sku: text("sku"), // AutoTradeOS stock-keeping unit
  skuComponents: json("sku_components").$type<SkuComponent[]>(), // Bill of materials for composite products
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  published: boolean("published").notNull().default(true),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  company: text("company"),
  serviceType: text("service_type").$type<KitServiceType>(), // Customer's chosen path: "car", "commercial", or "hybrid"
  vanId: varchar("van_id").references(() => vans.id),
  customVanDescription: text("custom_van_description"), // Free-text van details when not in system
  customVanValue: integer("custom_van_value"), // Van purchase price in pence (custom van only)
  kitId: varchar("kit_id").references(() => kits.id),
  selectedUpgradeIds: json("selected_upgrade_ids").$type<string[]>().notNull().default([]),
  selectedUpgrades: json("selected_upgrades").$type<Record<string, number>>().notNull().default({}),
  trainingOptionIds: json("training_option_ids").$type<string[]>().notNull().default([]),
  financePlanId: varchar("finance_plan_id").references(() => financePlans.id),
  financeInputs: json("finance_inputs").$type<{
    deposit?: number; // pence
    term?: number; // months
    balloon?: number;
    vatDeferredRequested?: boolean; // customer asked for VAT deferral in the configurator (admin confirms via vatDeferred)
  }>(),
  notes: text("notes"),
  estSubtotal: integer("est_subtotal").notNull(), // in pence (post-discount ex-VAT share of estTotal)
  estDiscount: integer("est_discount").notNull().default(0), // in pence (calculated discount amount)
  estVAT: integer("est_vat").notNull(), // in pence (calculated after discount)
  estTotal: integer("est_total").notNull(), // in pence (final price after discount)
  customExtras: json("custom_extras").$type<Array<{id: string; description: string; pricePence: number}>>().default([]), // Bespoke items not in standard configurator
  
  // Admin adjustments
  discountType: text("discount_type"), // "percentage" or "fixed"
  discountValue: integer("discount_value"), // percentage (e.g., 10 = 10%) or pence amount
  vatDeferred: boolean("vat_deferred").notNull().default(false), // When true, VAT is removed from the quote total (customer pays VAT separately)
  adminNotesHistory: json("admin_notes_history").$type<Array<{text: string; timestamp: string; author?: string}>>().notNull().default([]), // Internal notes history for staff
  customerNotesHistory: json("customer_notes_history").$type<Array<{text: string; timestamp: string; author?: string}>>().notNull().default([]), // Customer notes history
  
  // Quote confirmation
  confirmationToken: text("confirmation_token").unique(), // Unique token for customer confirmation link
  confirmedAt: timestamp("confirmed_at"), // When customer confirmed the quote

  // Finance submission
  customerConfirmed: boolean("customer_confirmed").notNull().default(false), // Customer verbally confirmed their config
  vanRegistration: text("van_registration"), // Specific van registration plate for finance submission
  vanMileage: integer("van_mileage"), // Current van mileage for finance submission
  financeSentAt: timestamp("finance_sent_at"), // When finance submission email was last sent
  specSentAt: timestamp("spec_sent_at"), // When spec summary email was last sent to customer
  
  // Customer approval of spec summary
  approvalToken: text("approval_token").unique(), // Unique token for customer approval link
  specApprovalStatus: text("spec_approval_status"), // null | 'approved' | 'rejected'
  specApprovalComments: text("spec_approval_comments"), // Customer comments if rejected
  
  featuredInPortfolio: boolean("featured_in_portfolio").notNull().default(false),
  status: text("status").notNull().default("new"),
  statusChangedAt: timestamp("status_changed_at"), // Set automatically whenever status changes
  buildStage: text("build_stage"),
  completedBuildStages: json("completed_build_stages").$type<Array<string | { id: string; initials: string }>>().notNull().default([]),
  customBuildStages: json("custom_build_stages").$type<Array<{id: string; label: string}>>(), // null = auto-generate from config
  financeStatus: text("finance_status").notNull().default("pending"),
  financeNotes: text("finance_notes"), // Notes added by finance partner
  financeDecisionAt: timestamp("finance_decision_at"), // When finance partner recorded their decision
  graphicsArtworkUrl: text("graphics_artwork_url"),
  graphicsArtworkApproved: boolean("graphics_artwork_approved").notNull().default(false),
  graphicsArtworkNotes: text("graphics_artwork_notes"),
  customerLogoUrls: json("customer_logo_urls").$type<string[]>().notNull().default([]),

  // Comparison mode fields
  comparisonConfig: json("comparison_config").$type<{
    slotA: {
      vanId?: string | null;
      customVanDescription?: string | null;
      customVanValue?: number | null;
      vanRegistration?: string | null;
      serviceType?: string | null;
      kitId?: string | null;
      upgradeIds?: string[];
      trainingOptionIds?: string[];
      financePlanId?: string | null;
      financeInputs?: { deposit?: number; term?: number; balloon?: number } | null;
      estSubtotal?: number;
      estVAT?: number;
      estTotal?: number;
    };
    slotB: {
      vanId?: string | null;
      customVanDescription?: string | null;
      customVanValue?: number | null;
      vanRegistration?: string | null;
      serviceType?: string | null;
      kitId?: string | null;
      upgradeIds?: string[];
      trainingOptionIds?: string[];
      financePlanId?: string | null;
      financeInputs?: { deposit?: number; term?: number; balloon?: number } | null;
      estSubtotal?: number;
      estVAT?: number;
      estTotal?: number;
      // Optional per-slot discount. When set, Option B uses this instead of the
      // main quote discount (which applies to Option A). Lets staff offer one
      // option at a different discount than the other.
      // discountValue is in percent for "percentage", or pence for "fixed".
      discountType?: "percentage" | "fixed" | null;
      discountValue?: number | null;
      estDiscount?: number;
    };
  } | null>(),
  chosenOption: text("chosen_option"), // null | 'A' | 'B'
  chooseOptionToken: text("choose_option_token"), // One-time token included in comparison email links — prevents link-scanner/prefetch from triggering option selection

  // Sage Business Cloud Accounting — invoice pushed from admin panel
  sageInvoiceId: text("sage_invoice_id"),
  sagePushedAt: timestamp("sage_pushed_at"),

  // Stock management integration — ID returned by autotradeportal.com when build is dispatched
  stockBuildId: text("stock_build_id"),

  // AutoTradeOS push history — append-only log of every successful push
  autotradePushes: jsonb("autotrade_pushes").$type<Array<{
    pushed_at: string;       // ISO timestamp
    pushed_by: string;       // username of staff member who pushed
    build_job_id?: string;   // job ID returned by AutoTradeOS
    parts_received?: number; // count of parts received by AutoTradeOS
  }>>().notNull().default([]),

  // AI session link — session ID of the Max chat that led to this quote
  aiSessionId: varchar("ai_session_id"),

  // Staff attribution — which team member created this quote in the admin configurator
  staffName: text("staff_name"),

  // CRM customer link
  customerId: varchar("customer_id"),
  previousCustomerName: text("previous_customer_name"), // Name of prior customer if this quote was reassigned
  previousCustomerId: varchar("previous_customer_id"),   // ID of prior customer if this quote was reassigned
  reassignedAt: timestamp("reassigned_at"),              // When the quote was last reassigned to a different customer
  reassignmentHistory: json("reassignment_history").$type<Array<{
    fromCustomerName: string;
    fromCustomerId: string;
    toCustomerName: string;
    toCustomerId: string;
    reassignedAt: string;
  }>>().notNull().default([]),                           // Full audit chain of all reassignments

  // WrapGen artwork approval tracking
  wrapgenPreviewId: text("wrapgen_preview_id"),      // ID extracted from the WrapGen preview URL (used for webhook matching)
  wrapgenPreviewUrl: text("wrapgen_preview_url"),    // Full WrapGen 3D render URL shared with customer
  wrapgenProofSentAt: timestamp("wrapgen_proof_sent_at", { withTimezone: true }), // When the proof URL was first/last saved by staff
  artworkApprovedAt: timestamp("artwork_approved_at", { withTimezone: true }), // Set by WrapGen webhook
  artworkApprovedBy: text("artwork_approved_by"),    // Approver name from WrapGen webhook payload

  // Wallboard / workshop scheduling
  targetCompletionDate: timestamp("target_completion_date"), // Staff-set due-out date shown on the pipeline wallboard

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_quotes_user_id").on(table.userId),
  index("idx_quotes_status").on(table.status),
  index("idx_quotes_build_stage").on(table.buildStage),
]);

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  source: text("source").notNull(),
  message: text("message"),
  status: text("status").notNull().default("new"), // "new" | "contacted" | "qualified" | "converted" | "closed" | "dead"
  statusChangedAt: timestamp("status_changed_at"),
  crmNotes: json("crm_notes").$type<Array<{text: string; timestamp: string; author?: string}>>().notNull().default([]),
  quoteId: varchar("quote_id").references(() => quotes.id), // Linked quote ID for converted leads
  customerId: varchar("customer_id"), // FK to customers — set after customers table is created
  previousCustomerName: text("previous_customer_name"), // Name of prior customer if this lead was reassigned
  previousCustomerId: varchar("previous_customer_id"),   // ID of prior customer if this lead was reassigned
  reassignedAt: timestamp("reassigned_at"),              // When the lead was last reassigned to a different customer
  reassignmentHistory: json("reassignment_history").$type<Array<{
    fromCustomerName: string;
    fromCustomerId: string;
    toCustomerName: string;
    toCustomerId: string;
    reassignedAt: string;
  }>>().notNull().default([]),                           // Full audit chain of all reassignments
  createdAt: timestamp("created_at").defaultNow(),
});

export const followUps = pgTable("follow_ups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  scheduledDate: text("scheduled_date").notNull(), // YYYY-MM-DD
  notes: text("notes"),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  assignedToName: text("assigned_to_name"),
  assignedToEmail: text("assigned_to_email"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFollowUpSchema = createInsertSchema(followUps).omit({
  id: true,
  createdAt: true,
});
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;
export type FollowUp = typeof followUps.$inferSelect;

export const financePlans = pgTable("finance_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // "HP" or "Lease"
  termMonths: integer("term_months").notNull(),
  aprBps: integer("apr_bps").notNull(), // APR in basis points (e.g., 595 = 5.95%)
  depositPercent: integer("deposit_percent").notNull(), // Deposit percentage (e.g., 10 = 10%)
  balloonPercent: integer("balloon_percent"), // Optional balloon payment percentage
  notes: text("notes"),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trainingOptions = pgTable("training_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // e.g., "REACT", "Tyre Fitting"
  durationDays: integer("duration_days").notNull(), // Duration in days
  includes: json("includes").$type<string[]>().notNull().default([]),
  price: integer("price").notNull(), // in pence
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const galleryItems = pgTable("gallery_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(), // e.g., "Complete Builds", "Interior Layouts"
  type: text("type").notNull(), // "image" or "video"
  fileUrl: text("file_url").notNull(), // URL to the uploaded file in object storage
  thumbnailUrl: text("thumbnail_url"), // Optional thumbnail for videos
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export const createUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email({ message: "A valid email is required to send the set-password link" }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isAdmin: z.boolean().default(false),
  adminRole: z.enum(adminRoles).default("none"),
});

export const updateUserRoleSchema = z.object({
  adminRole: z.enum(adminRoles),
});

export const insertVanSchema = createInsertSchema(vans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  saleStatus: z.enum(vanSaleStatuses).optional(),
});

// A van plus its computed sale state. `derivedSaleStatus` comes from any linked
// quote (deposit taken / in build); `effectiveSaleStatus` is the higher of the
// manual `saleStatus` and the derived one — that's what staff should see.
export type VanWithSaleStatus = Van & {
  derivedSaleStatus: VanSaleStatus;
  effectiveSaleStatus: VanSaleStatus;
};

export const insertKitSchema = createInsertSchema(kits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUpgradeSchema = createInsertSchema(upgrades).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const chosenOptionValues = ['A', 'B'] as const;
export type ChosenOption = typeof chosenOptionValues[number];

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
}).extend({
  status: z.enum(quoteStatuses).optional(),
  buildStage: z.enum(buildStages).nullable().optional(),
  financeStatus: z.enum(financeStatuses).optional(),
  chosenOption: z.enum(chosenOptionValues).nullable().optional(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export const insertFinancePlanSchema = createInsertSchema(financePlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingOptionSchema = createInsertSchema(trainingOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGalleryItemSchema = createInsertSchema(galleryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Testimonials table
export const testimonials = pgTable("testimonials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company").notNull(),
  location: text("location"),
  content: text("content").notNull(),
  rating: integer("rating").notNull().default(5),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTestimonialSchema = createInsertSchema(testimonials).omit({
  id: true,
  createdAt: true,
}).extend({
  rating: z.number().int().min(1).max(5),
});

export type InsertTestimonial = z.infer<typeof insertTestimonialSchema>;
export type Testimonial = typeof testimonials.$inferSelect;

// Testimonial request tokens (sent to customers via email)
export const testimonialTokens = pgTable("testimonial_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  usedAt: timestamp("used_at"),
});

export type TestimonialToken = typeof testimonialTokens.$inferSelect;

// Blog posts table
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  featuredImage: text("featured_image"),
  category: text("category"),
  tags: json("tags").$type<string[]>().notNull().default([]),
  published: boolean("published").notNull().default(false),
  publishedAt: timestamp("published_at"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  authorName: text("author_name"),
  authorBio: text("author_bio"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

// Types
export type AdminRole = typeof adminRoles[number];
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUserRole = z.infer<typeof updateUserRoleSchema>;

export type InsertVan = z.infer<typeof insertVanSchema>;
export type Van = typeof vans.$inferSelect;

export type InsertKit = z.infer<typeof insertKitSchema>;
export type Kit = typeof kits.$inferSelect;

export type InsertUpgrade = z.infer<typeof insertUpgradeSchema>;
export type Upgrade = typeof upgrades.$inferSelect;

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertFinancePlan = z.infer<typeof insertFinancePlanSchema>;
export type FinancePlan = typeof financePlans.$inferSelect;

export type InsertTrainingOption = z.infer<typeof insertTrainingOptionSchema>;
export type TrainingOption = typeof trainingOptions.$inferSelect;

export type InsertGalleryItem = z.infer<typeof insertGalleryItemSchema>;
export type GalleryItem = typeof galleryItems.$inferSelect;


// Site settings table for storing configurable values like video URLs
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;

// ============================================================
// Web Analytics Tables
// ============================================================

export const analyticsSessions = pgTable("analytics_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  userAgent: text("user_agent"),
  deviceType: varchar("device_type"), // mobile, tablet, desktop
  browser: varchar("browser"),
  os: varchar("os"),
  ipHash: varchar("ip_hash"),
  referrer: text("referrer"),
  utmSource: varchar("utm_source"),
  utmMedium: varchar("utm_medium"),
  utmCampaign: varchar("utm_campaign"),
  utmTerm: varchar("utm_term"),
  utmContent: varchar("utm_content"),
  entryPage: text("entry_page"),
  exitPage: text("exit_page"),
  pageCount: integer("page_count").default(1),
  bounce: boolean("bounce").default(true),
  durationSeconds: integer("duration_seconds"),
  isAdmin: boolean("is_admin").notNull().default(false),
  startedAt: timestamp("started_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
}, (table) => [
  index("idx_sessions_session_id").on(table.sessionId),
  index("idx_sessions_started_at").on(table.startedAt),
]);

export const analyticsPageviews = pgTable("analytics_pageviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  referrer: text("referrer"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_pageviews_session").on(table.sessionId),
  index("idx_pageviews_created").on(table.createdAt),
]);

export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  eventName: varchar("event_name").notNull(),
  eventData: jsonb("event_data"),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_events_session").on(table.sessionId),
  index("idx_events_name").on(table.eventName),
  index("idx_events_created").on(table.createdAt),
]);

export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type AnalyticsPageview = typeof analyticsPageviews.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// ─── CRM Customers ─────────────────────────────────────────────────────────
export const customerNoteTypes = ["call", "email", "meeting", "general"] as const;
export type CustomerNoteType = typeof customerNoteTypes[number];

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  primaryStaffId: varchar("primary_staff_id").references(() => users.id),
  vrmInstallationId: text("vrm_installation_id"), // Victron VRM installation id for 48V power-system monitoring
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_customers_email").on(table.email),
  index("idx_customers_phone").on(table.phone),
]);

export const customerNotes = pgTable("customer_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  authorId: varchar("author_id").references(() => users.id),
  authorName: text("author_name"),
  noteType: text("note_type").notNull().default("general"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_customer_notes_customer").on(table.customerId),
]);

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
export const insertCustomerNoteSchema = createInsertSchema(customerNotes).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomerNote = z.infer<typeof insertCustomerNoteSchema>;
export type CustomerNote = typeof customerNotes.$inferSelect;

// ─── Customer Merge History ──────────────────────────────────────────────────
// Logged every time mergeCustomers() runs so merges can be undone (split apart).
export const customerMergeHistory = pgTable("customer_merge_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Surviving customer
  keepId: varchar("keep_id").notNull(),
  keepSnapshotName: text("keep_snapshot_name"),
  keepSnapshotEmail: text("keep_snapshot_email"),
  keepSnapshotPhone: text("keep_snapshot_phone"),
  keepSnapshotCompany: text("keep_snapshot_company"),
  // Deleted (absorbed) customer — snapshot taken before deletion
  removedId: varchar("removed_id").notNull(),
  removedSnapshotName: text("removed_snapshot_name"),
  removedSnapshotEmail: text("removed_snapshot_email"),
  removedSnapshotPhone: text("removed_snapshot_phone"),
  removedSnapshotCompany: text("removed_snapshot_company"),
  // Which child records were re-pointed from removedId → keepId
  leadsRelinked: json("leads_relinked").$type<string[]>().notNull().default([]),
  quotesRelinked: json("quotes_relinked").$type<string[]>().notNull().default([]),
  conversationsRelinked: json("conversations_relinked").$type<string[]>().notNull().default([]),
  notesRelinked: json("notes_relinked").$type<string[]>().notNull().default([]),
  triggeredBy: varchar("triggered_by"), // user ID of the staff member who ran deduplication
  splitBy: varchar("split_by"), // user ID of the staff member who undid (split) the merge
  mergedAt: timestamp("merged_at").defaultNow(),
  splitAt: timestamp("split_at"), // null until the merge is undone
}, (table) => [
  index("idx_merge_history_keep").on(table.keepId),
  index("idx_merge_history_merged_at").on(table.mergedAt),
]);

export type CustomerMergeHistory = typeof customerMergeHistory.$inferSelect;

export const aiConversations = pgTable("ai_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  status: varchar("status").notNull().default("in_progress"),
  messages: json("messages").$type<Array<{role: string; content: string}>>().notNull().default([]),
  mappedConfig: json("mapped_config").$type<Record<string, unknown>>(),
  contactName: varchar("contact_name"),
  contactPhone: varchar("contact_phone"),
  vanType: varchar("van_type"),
  vanSize: varchar("van_size"),
  specLevel: varchar("spec_level"),
  financePreference: varchar("finance_preference"),
  includes48v: boolean("includes_48v").notNull().default(false),
  was48vPitched: boolean("was_48v_pitched").notNull().default(false),
  responseToThis48v: varchar("response_to_48v"),
  suggestedUpgradeIds: json("suggested_upgrade_ids").$type<string[]>().notNull().default([]),
  addedUpgradeIds: json("added_upgrade_ids").$type<string[]>().notNull().default([]),
  configCompleted: boolean("config_completed").notNull().default(false),
  markedContacted: boolean("marked_contacted").notNull().default(false),
  contactedNote: text("contacted_note"),
  customerId: varchar("customer_id"),
  previousCustomerName: text("previous_customer_name"), // Name of prior customer if this conversation was reassigned
  previousCustomerId: varchar("previous_customer_id"),   // ID of prior customer if this conversation was reassigned
  reassignedAt: timestamp("reassigned_at"),              // When the conversation was last reassigned to a different customer
  reassignmentHistory: json("reassignment_history").$type<Array<{
    fromCustomerName: string;
    fromCustomerId: string;
    toCustomerName: string;
    toCustomerId: string;
    reassignedAt: string;
  }>>().notNull().default([]),                           // Full audit chain of all reassignments
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type AiConversation = typeof aiConversations.$inferSelect;

// ─── AI Packages (Bronze / Silver / Gold) ───────────────────────────────────
// Managed in the admin panel. Provides the AI with a finite set of tiered
// packages so it recommends a complete spec rather than picking upgrades ad-hoc.
export const aiPackages = pgTable("ai_packages", {
  id: varchar("id", { length: 50 }).primaryKey(), // "bronze" | "silver" | "gold"
  name: varchar("name", { length: 50 }).notNull(),
  tier: integer("tier").notNull(), // 1=bronze 2=silver 3=gold
  description: text("description"),
  recommendedFor: text("recommended_for"),
  upgradeIds: json("upgrade_ids").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
});

export type AiPackage = typeof aiPackages.$inferSelect;

// ─── Artwork Proofs ──────────────────────────────────────────────────────────
export const artworkProofStatuses = ["pending_review", "approved", "changes_requested"] as const;
export type ArtworkProofStatus = typeof artworkProofStatuses[number];

export const artworkProofs = pgTable("artwork_proofs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  quoteId: varchar("quote_id"),
  uploadedById: varchar("uploaded_by_id"),
  files: jsonb("files").$type<Array<{ url: string; name: string }>>().notNull().default([]),
  status: text("status").notNull().default("pending_review"),
  token: varchar("token").notNull().unique(),
  adminNotes: text("admin_notes"),
  customerNotes: text("customer_notes"),
  sentAt: timestamp("sent_at"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertArtworkProofSchema = createInsertSchema(artworkProofs).omit({
  id: true,
  token: true,
  sentAt: true,
  respondedAt: true,
  createdAt: true,
});
export type InsertArtworkProof = z.infer<typeof insertArtworkProofSchema>;
export type ArtworkProof = typeof artworkProofs.$inferSelect;

// ─── Stock Items ─────────────────────────────────────────────────────────────
// On-hand quantity for every component SKU tracked in the warehouse.
export const stockItems = pgTable("stock_items", {
  sku: text("sku").primaryKey(),
  description: text("description").notNull().default(""),
  onHand: integer("on_hand").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStockItemSchema = createInsertSchema(stockItems);
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;
export type StockItem = typeof stockItems.$inferSelect;

// ─── Stock Deductions ─────────────────────────────────────────────────────────
// Append-only log of every stock deduction from the Build Sheet scanner.
export const stockDeductions = pgTable("stock_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull(),
  quantityDeducted: integer("quantity_deducted").notNull(),
  quoteId: varchar("quote_id").references(() => quotes.id),
  buildSheetRef: text("build_sheet_ref").notNull().default(""),
  scannedBySession: text("scanned_by_session"),
  kitId: varchar("kit_id"),
  upgradeId: varchar("upgrade_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stock_deductions_sku").on(table.sku),
  index("idx_stock_deductions_quote").on(table.quoteId),
]);

export const insertStockDeductionSchema = createInsertSchema(stockDeductions).omit({ id: true, createdAt: true });
export type InsertStockDeduction = z.infer<typeof insertStockDeductionSchema>;
export type StockDeduction = typeof stockDeductions.$inferSelect;

// ─── Staff Phone Numbers (for Twilio click-to-call) ──────────────────────────
// Global list managed by full admins only. Ordered by sort_order then created_at.
export const staffPhoneNumbers = pgTable("staff_phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull().default("Mobile"),
  phone: text("phone").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStaffPhoneSchema = createInsertSchema(staffPhoneNumbers).omit({
  id: true,
  createdAt: true,
});
export type InsertStaffPhone = z.infer<typeof insertStaffPhoneSchema>;
export type StaffPhone = typeof staffPhoneNumbers.$inferSelect;

// ─── SKU Stock Levels (updated by AutoTradeOS webhook) ───────────────────────
export const skuStockLevels = pgTable("sku_stock_levels", {
  sku: text("sku").primaryKey(),
  stockQty: integer("stock_qty").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
export type SkuStockLevel = typeof skuStockLevels.$inferSelect;
