import { 
  type User, type InsertUser,
  type Van, type InsertVan,
  type Kit, type InsertKit,
  type Upgrade, type InsertUpgrade,
  type Quote, type InsertQuote,
  type Lead, type InsertLead,
  type FollowUp, type InsertFollowUp,
  type FinancePlan, type InsertFinancePlan,
  type TrainingOption, type InsertTrainingOption,
  type GalleryItem, type InsertGalleryItem,
  type BlogPost, type InsertBlogPost,
  type SiteSetting,
  type Testimonial, type InsertTestimonial,
  type TestimonialToken,
  type Customer, type InsertCustomer,
  type CustomerNote, type InsertCustomerNote,
  type CustomerMergeHistory,
  type StaffPhone, type InsertStaffPhone,
  type StockItem, type InsertStockItem,
  type StockDeduction,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getUserByResetToken(token: string): Promise<User | undefined>;

  // Vans
  getVans(filters?: { make?: string; year?: number; maxPrice?: number; minPrice?: number; transmission?: string; size?: string }): Promise<Van[]>;
  getVansAdmin(): Promise<Van[]>; // Returns all vans including unpublished for admin
  getVan(id: string): Promise<Van | undefined>;
  getVanBySlug(slug: string): Promise<Van | undefined>;
  createVan(van: InsertVan): Promise<Van>;
  updateVan(id: string, van: Partial<InsertVan>): Promise<Van | undefined>;
  deleteVan(id: string): Promise<boolean>;

  // Kits
  getKits(): Promise<Kit[]>;
  getKitsAdmin(): Promise<Kit[]>; // Returns all kits including unpublished for admin
  getKit(id: string): Promise<Kit | undefined>;
  createKit(kit: InsertKit): Promise<Kit>;
  updateKit(id: string, kit: Partial<InsertKit>): Promise<Kit | undefined>;
  deleteKit(id: string): Promise<boolean>;

  // Upgrades
  getUpgrades(category?: string): Promise<Upgrade[]>;
  getAllUpgradesAdmin(): Promise<Upgrade[]>;
  getUpgrade(id: string): Promise<Upgrade | undefined>;
  createUpgrade(upgrade: InsertUpgrade): Promise<Upgrade>;
  updateUpgrade(id: string, upgrade: Partial<InsertUpgrade>): Promise<Upgrade | undefined>;
  deleteUpgrade(id: string): Promise<boolean>;

  // Quotes
  getQuotes(): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteByConfirmationToken(token: string): Promise<Quote | undefined>;
  getQuotesByUserId(userId: string): Promise<Quote[]>;
  getCompletedPortfolioQuotes(): Promise<Quote[]>;
  /** Minimal rows for deriving van sale status — avoids loading full quote JSON. */
  getVanSaleStatusRows(): Promise<Array<{ vanId: string | null; status: string }>>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<Quote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<boolean>;

  // Leads
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined>;

  // Follow-ups
  getFollowUps(): Promise<FollowUp[]>;
  getFollowUpsByQuote(quoteId: string): Promise<FollowUp[]>;
  getTodayFollowUps(): Promise<FollowUp[]>;
  getFollowUpsNeedingReminder(date: string): Promise<FollowUp[]>;
  getFollowUp(id: string): Promise<FollowUp | undefined>;
  createFollowUp(followUp: InsertFollowUp): Promise<FollowUp>;
  updateFollowUp(id: string, data: Partial<FollowUp>): Promise<FollowUp | undefined>;
  deleteFollowUp(id: string): Promise<boolean>;

  // Finance Plans
  getFinancePlans(): Promise<FinancePlan[]>;
  getFinancePlan(id: string): Promise<FinancePlan | undefined>;
  createFinancePlan(plan: InsertFinancePlan): Promise<FinancePlan>;
  updateFinancePlan(id: string, plan: Partial<InsertFinancePlan>): Promise<FinancePlan | undefined>;
  deleteFinancePlan(id: string): Promise<boolean>;

  // Training Options
  getTrainingOptions(): Promise<TrainingOption[]>;
  getTrainingOption(id: string): Promise<TrainingOption | undefined>;
  createTrainingOption(option: InsertTrainingOption): Promise<TrainingOption>;
  updateTrainingOption(id: string, option: Partial<InsertTrainingOption>): Promise<TrainingOption | undefined>;
  deleteTrainingOption(id: string): Promise<boolean>;

  // Gallery Items
  getGalleryItems(): Promise<GalleryItem[]>;
  getGalleryItemsAdmin(): Promise<GalleryItem[]>; // Returns all items including unpublished for admin
  getGalleryItem(id: string): Promise<GalleryItem | undefined>;
  createGalleryItem(item: InsertGalleryItem): Promise<GalleryItem>;
  updateGalleryItem(id: string, item: Partial<InsertGalleryItem>): Promise<GalleryItem | undefined>;
  deleteGalleryItem(id: string): Promise<boolean>;

  // Blog Posts
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPostsAdmin(): Promise<BlogPost[]>;
  getBlogPost(id: string): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, post: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: string): Promise<boolean>;

  // Testimonials
  getTestimonials(): Promise<Testimonial[]>;
  getTestimonialsAdmin(): Promise<Testimonial[]>;
  getTestimonial(id: string): Promise<Testimonial | undefined>;
  createTestimonial(item: InsertTestimonial): Promise<Testimonial>;
  updateTestimonial(id: string, item: Partial<InsertTestimonial>): Promise<Testimonial | undefined>;
  deleteTestimonial(id: string): Promise<boolean>;

  // Testimonial tokens
  createTestimonialToken(token: string, customerName: string, customerEmail: string): Promise<TestimonialToken>;
  getTestimonialToken(token: string): Promise<TestimonialToken | undefined>;
  markTestimonialTokenUsed(token: string): Promise<void>;

  // Site Settings
  getSiteSettings(): Promise<Record<string, string>>;
  setSiteSetting(key: string, value: string): Promise<void>;

  // Customers (CRM)
  getCustomers(search?: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  findCustomerByEmail(email: string): Promise<Customer | undefined>;
  findCustomerByPhone(phone: string): Promise<Customer | undefined>;
  findOrCreateCustomer(email: string | null, phone: string | null, name: string): Promise<Customer>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  getCustomerNotes(customerId: string): Promise<CustomerNote[]>;
  createCustomerNote(note: InsertCustomerNote): Promise<CustomerNote>;
  deleteCustomer(id: string): Promise<void>;
  linkLeadToCustomer(leadId: string, customerId: string, staffName?: string): Promise<void>;
  linkQuoteToCustomer(quoteId: string, customerId: string, staffName?: string): Promise<void>;
  linkConversationToCustomer(conversationId: string, customerId: string, staffName?: string): Promise<void>;
  linkConversationBySessionToCustomer(sessionId: string, customerId: string, staffName?: string): Promise<void>;
  mergeCustomers(keepId: string, mergeId: string, triggeredBy?: string): Promise<{ leadsRepointed: number; quotesRepointed: number; convosRepointed: number; historyId: string }>;
  getMergeHistory(limit?: number, keepId?: string): Promise<CustomerMergeHistory[]>;
  splitMerge(historyId: string): Promise<{ newCustomerId: string }>;

  // Staff Phone Numbers (for Twilio click-to-call)
  getStaffPhones(): Promise<StaffPhone[]>;
  getStaffPhone(id: string): Promise<StaffPhone | undefined>;
  createStaffPhone(data: InsertStaffPhone): Promise<StaffPhone>;
  updateStaffPhone(id: string, data: Partial<InsertStaffPhone>): Promise<StaffPhone | undefined>;
  deleteStaffPhone(id: string): Promise<boolean>;

  // Stock tracking
  getStockItems(): Promise<StockItem[]>;
  getStockItem(sku: string): Promise<StockItem | undefined>;
  upsertStockItem(sku: string, data: Partial<InsertStockItem>): Promise<StockItem>;
  adjustStockDelta(sku: string, delta: number): Promise<StockItem>;
  deductStock(sku: string, quantity: number, quoteId?: string, buildSheetRef?: string, scannedBySession?: string, kitId?: string, upgradeId?: string): Promise<StockItem>;
  getLowStockCount(): Promise<number>;
  getStockDeductionHistory(sku: string, limit?: number): Promise<StockDeduction[]>;
  syncStockFromBom(defaultThreshold?: number, triggeredBy?: string): Promise<{ synced: number; newSkus: string[] }>;
  previewSyncFromBom(): Promise<{ totalBomSkus: number; alreadyTracked: number; newSkus: number }>;
  logBomSync(skusImported: number, triggeredBy?: string): Promise<void>;
  getBomSyncHistory(limit?: number): Promise<Array<{ id: string; syncedAt: Date; skusImported: number; triggeredBy: string | null }>>;
}


// Database Storage Implementation
import { db, pool } from "./db";
import * as schema from "@shared/schema";
import { eq, and, gte, lte, asc, isNull, or, ilike, desc, sql } from "drizzle-orm";

/** Returns true when the error is a PostgreSQL unique_violation (SQLSTATE 23505). */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  return (err as { code?: string }).code === "23505";
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(schema.users);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(schema.users).where(eq(schema.users.id, id)).returning();
    return result.length > 0;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.passwordResetToken, token)).limit(1);
    return result[0];
  }

  // Vans
  async getVans(filters?: { make?: string; year?: number; maxPrice?: number; minPrice?: number; transmission?: string; size?: string }): Promise<Van[]> {
    let query = db.select().from(schema.vans).where(eq(schema.vans.published, true));
    
    if (filters) {
      const conditions = [];
      if (filters.make) conditions.push(eq(schema.vans.make, filters.make));
      if (filters.year) conditions.push(eq(schema.vans.year, filters.year));
      if (filters.minPrice) conditions.push(gte(schema.vans.price, filters.minPrice));
      if (filters.maxPrice) conditions.push(lte(schema.vans.price, filters.maxPrice));
      
      if (conditions.length > 0) {
        query = db.select().from(schema.vans).where(and(eq(schema.vans.published, true), ...conditions));
      }
    }
    
    return await query;
  }

  async getVansAdmin(): Promise<Van[]> {
    return await db.select().from(schema.vans);
  }

  async getVan(id: string): Promise<Van | undefined> {
    const result = await db.select().from(schema.vans).where(eq(schema.vans.id, id));
    return result[0];
  }

  async getVanBySlug(slug: string): Promise<Van | undefined> {
    const result = await db.select().from(schema.vans).where(eq(schema.vans.slug, slug));
    return result[0];
  }

  async createVan(insertVan: InsertVan): Promise<Van> {
    // Check if slug already exists, and make it unique if needed
    let finalSlug = insertVan.slug;
    let counter = 1;
    
    while (true) {
      const existing = await db.select().from(schema.vans).where(eq(schema.vans.slug, finalSlug));
      if (existing.length === 0) break;
      
      // Add counter to make slug unique
      finalSlug = `${insertVan.slug}-${counter}`;
      counter++;
    }
    
    const result = await db.insert(schema.vans).values({ ...insertVan, slug: finalSlug }).returning();
    return result[0];
  }

  async updateVan(id: string, insertVan: Partial<InsertVan>): Promise<Van | undefined> {
    const result = await db.update(schema.vans).set(insertVan).where(eq(schema.vans.id, id)).returning();
    return result[0];
  }

  async deleteVan(id: string): Promise<boolean> {
    const result = await db.delete(schema.vans).where(eq(schema.vans.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Kits
  async getKits(): Promise<Kit[]> {
    return await db.select().from(schema.kits).where(eq(schema.kits.published, true)).orderBy(asc(schema.kits.sortOrder));
  }

  async getKitsAdmin(): Promise<Kit[]> {
    return await db.select().from(schema.kits).orderBy(asc(schema.kits.sortOrder));
  }

  async getKit(id: string): Promise<Kit | undefined> {
    const result = await db.select().from(schema.kits).where(eq(schema.kits.id, id));
    return result[0];
  }

  async createKit(insertKit: InsertKit): Promise<Kit> {
    const result = await db.insert(schema.kits).values(insertKit).returning();
    return result[0];
  }

  async updateKit(id: string, insertKit: Partial<InsertKit>): Promise<Kit | undefined> {
    const result = await db.update(schema.kits).set(insertKit).where(eq(schema.kits.id, id)).returning();
    return result[0];
  }

  async deleteKit(id: string): Promise<boolean> {
    const result = await db.delete(schema.kits).where(eq(schema.kits.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Upgrades
  async getUpgrades(category?: string): Promise<Upgrade[]> {
    if (category) {
      return await db.select().from(schema.upgrades).where(
        and(eq(schema.upgrades.published, true), eq(schema.upgrades.category, category))
      ).orderBy(schema.upgrades.sortOrder, schema.upgrades.name);
    }
    return await db.select().from(schema.upgrades).where(eq(schema.upgrades.published, true))
      .orderBy(schema.upgrades.sortOrder, schema.upgrades.name);
  }

  async getAllUpgradesAdmin(): Promise<Upgrade[]> {
    return await db.select().from(schema.upgrades)
      .orderBy(schema.upgrades.sortOrder, schema.upgrades.name);
  }

  async getUpgrade(id: string): Promise<Upgrade | undefined> {
    const result = await db.select().from(schema.upgrades).where(eq(schema.upgrades.id, id));
    return result[0];
  }

  async createUpgrade(insertUpgrade: InsertUpgrade): Promise<Upgrade> {
    const result = await db.insert(schema.upgrades).values(insertUpgrade).returning();
    return result[0];
  }

  async updateUpgrade(id: string, insertUpgrade: Partial<InsertUpgrade>): Promise<Upgrade | undefined> {
    const result = await db.update(schema.upgrades).set(insertUpgrade).where(eq(schema.upgrades.id, id)).returning();
    return result[0];
  }

  async deleteUpgrade(id: string): Promise<boolean> {
    const result = await db.delete(schema.upgrades).where(eq(schema.upgrades.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Quotes
  async getQuotes(): Promise<Quote[]> {
    return await db.select().from(schema.quotes);
  }

  async getQuoteByConfirmationToken(token: string): Promise<Quote | undefined> {
    const result = await db.select().from(schema.quotes).where(eq(schema.quotes.confirmationToken, token));
    return result[0];
  }

  async getQuotesByUserId(userId: string): Promise<Quote[]> {
    return await db.select().from(schema.quotes).where(eq(schema.quotes.userId, userId));
  }

  async getCompletedPortfolioQuotes(): Promise<Quote[]> {
    return await db.select().from(schema.quotes).where(
      and(eq(schema.quotes.status, "completed"), eq(schema.quotes.featuredInPortfolio, true))
    );
  }

  async getVanSaleStatusRows(): Promise<Array<{ vanId: string | null; status: string }>> {
    const { rows } = await pool.query(
      `SELECT van_id AS "vanId", status FROM quotes
       WHERE van_id IS NOT NULL
         AND status IN ('deposit_taken', 'finance_approved', 'in_build', 'in_workshop', 'completed')`
    );
    return rows;
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const result = await db.select().from(schema.quotes).where(eq(schema.quotes.id, id));
    return result[0];
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const result = await db.insert(schema.quotes).values(insertQuote).returning();
    return result[0];
  }

  async updateQuote(id: string, updateQuote: Partial<Quote>): Promise<Quote | undefined> {
    const result = await db.update(schema.quotes).set(updateQuote).where(eq(schema.quotes.id, id)).returning();
    return result[0];
  }

  async deleteQuote(id: string): Promise<boolean> {
    const result = await db.delete(schema.quotes).where(eq(schema.quotes.id, id)).returning();
    return result.length > 0;
  }

  // Leads
  async getLeads(): Promise<Lead[]> {
    return await db.select().from(schema.leads);
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const result = await db.select().from(schema.leads).where(eq(schema.leads.id, id));
    return result[0];
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const result = await db.insert(schema.leads).values(insertLead).returning();
    return result[0];
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined> {
    const result = await db.update(schema.leads).set(data).where(eq(schema.leads.id, id)).returning();
    return result[0];
  }

  // Finance Plans
  async getFinancePlans(): Promise<FinancePlan[]> {
    return await db.select().from(schema.financePlans).where(eq(schema.financePlans.published, true));
  }

  async getFinancePlan(id: string): Promise<FinancePlan | undefined> {
    const result = await db.select().from(schema.financePlans).where(eq(schema.financePlans.id, id));
    return result[0];
  }

  async createFinancePlan(insertPlan: InsertFinancePlan): Promise<FinancePlan> {
    const result = await db.insert(schema.financePlans).values(insertPlan).returning();
    return result[0];
  }

  async updateFinancePlan(id: string, insertPlan: Partial<InsertFinancePlan>): Promise<FinancePlan | undefined> {
    const result = await db.update(schema.financePlans).set(insertPlan).where(eq(schema.financePlans.id, id)).returning();
    return result[0];
  }

  async deleteFinancePlan(id: string): Promise<boolean> {
    const result = await db.delete(schema.financePlans).where(eq(schema.financePlans.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Training Options
  async getTrainingOptions(): Promise<TrainingOption[]> {
    return db.select().from(schema.trainingOptions).where(eq(schema.trainingOptions.published, true));
  }

  async getTrainingOption(id: string): Promise<TrainingOption | undefined> {
    const results = await db.select().from(schema.trainingOptions).where(eq(schema.trainingOptions.id, id));
    return results[0];
  }

  async createTrainingOption(option: InsertTrainingOption): Promise<TrainingOption> {
    const results = await db.insert(schema.trainingOptions).values(option).returning();
    return results[0];
  }

  async updateTrainingOption(id: string, option: Partial<InsertTrainingOption>): Promise<TrainingOption | undefined> {
    const results = await db.update(schema.trainingOptions)
      .set({ ...option, updatedAt: new Date() })
      .where(eq(schema.trainingOptions.id, id))
      .returning();
    return results[0];
  }

  async deleteTrainingOption(id: string): Promise<boolean> {
    const result = await db.delete(schema.trainingOptions).where(eq(schema.trainingOptions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Gallery Items
  async getGalleryItems(): Promise<GalleryItem[]> {
    return db.select().from(schema.galleryItems).where(eq(schema.galleryItems.published, true)).orderBy(schema.galleryItems.sortOrder);
  }

  async getGalleryItemsAdmin(): Promise<GalleryItem[]> {
    return db.select().from(schema.galleryItems).orderBy(schema.galleryItems.sortOrder);
  }

  async getGalleryItem(id: string): Promise<GalleryItem | undefined> {
    const results = await db.select().from(schema.galleryItems).where(eq(schema.galleryItems.id, id));
    return results[0];
  }

  async createGalleryItem(item: InsertGalleryItem): Promise<GalleryItem> {
    const results = await db.insert(schema.galleryItems).values(item).returning();
    return results[0];
  }

  async updateGalleryItem(id: string, item: Partial<InsertGalleryItem>): Promise<GalleryItem | undefined> {
    const results = await db.update(schema.galleryItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(schema.galleryItems.id, id))
      .returning();
    return results[0];
  }

  async deleteGalleryItem(id: string): Promise<boolean> {
    const result = await db.delete(schema.galleryItems).where(eq(schema.galleryItems.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSiteSettings(): Promise<Record<string, string>> {
    const rows = await db.select().from(schema.siteSettings);
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  async setSiteSetting(key: string, value: string): Promise<void> {
    await db.insert(schema.siteSettings)
      .values({ key, value })
      .onConflictDoUpdate({ target: schema.siteSettings.key, set: { value, updatedAt: new Date() } });
  }

  // Blog Posts
  async getBlogPosts(): Promise<BlogPost[]> {
    return db.select().from(schema.blogPosts)
      .where(eq(schema.blogPosts.published, true))
      .orderBy(schema.blogPosts.publishedAt);
  }

  async getBlogPostsAdmin(): Promise<BlogPost[]> {
    return db.select().from(schema.blogPosts).orderBy(schema.blogPosts.createdAt);
  }

  async getBlogPost(id: string): Promise<BlogPost | undefined> {
    const results = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.id, id));
    return results[0];
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const results = await db.select().from(schema.blogPosts).where(eq(schema.blogPosts.slug, slug));
    return results[0];
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const results = await db.insert(schema.blogPosts).values(post).returning();
    return results[0];
  }

  async updateBlogPost(id: string, post: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const results = await db.update(schema.blogPosts)
      .set({ ...post, updatedAt: new Date() })
      .where(eq(schema.blogPosts.id, id))
      .returning();
    return results[0];
  }

  async deleteBlogPost(id: string): Promise<boolean> {
    const result = await db.delete(schema.blogPosts).where(eq(schema.blogPosts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Testimonials
  async getTestimonials(): Promise<Testimonial[]> {
    return db.select().from(schema.testimonials).where(eq(schema.testimonials.published, true)).orderBy(schema.testimonials.sortOrder);
  }

  async getTestimonialsAdmin(): Promise<Testimonial[]> {
    return db.select().from(schema.testimonials).orderBy(schema.testimonials.sortOrder);
  }

  async getTestimonial(id: string): Promise<Testimonial | undefined> {
    const results = await db.select().from(schema.testimonials).where(eq(schema.testimonials.id, id));
    return results[0];
  }

  async createTestimonial(item: InsertTestimonial): Promise<Testimonial> {
    const results = await db.insert(schema.testimonials).values(item).returning();
    return results[0];
  }

  async updateTestimonial(id: string, item: Partial<InsertTestimonial>): Promise<Testimonial | undefined> {
    const results = await db.update(schema.testimonials)
      .set(item)
      .where(eq(schema.testimonials.id, id))
      .returning();
    return results[0];
  }

  async deleteTestimonial(id: string): Promise<boolean> {
    const result = await db.delete(schema.testimonials).where(eq(schema.testimonials.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createTestimonialToken(token: string, customerName: string, customerEmail: string): Promise<TestimonialToken> {
    const results = await db.insert(schema.testimonialTokens).values({ token, customerName, customerEmail }).returning();
    return results[0];
  }

  async getTestimonialToken(token: string): Promise<TestimonialToken | undefined> {
    const results = await db.select().from(schema.testimonialTokens).where(eq(schema.testimonialTokens.token, token));
    return results[0];
  }

  async markTestimonialTokenUsed(token: string): Promise<void> {
    await db.update(schema.testimonialTokens).set({ usedAt: new Date() }).where(eq(schema.testimonialTokens.token, token));
  }

  // Follow-ups
  async getFollowUps(): Promise<FollowUp[]> {
    return db.select().from(schema.followUps).orderBy(asc(schema.followUps.scheduledDate));
  }

  async getFollowUpsByQuote(quoteId: string): Promise<FollowUp[]> {
    return db.select().from(schema.followUps)
      .where(eq(schema.followUps.quoteId, quoteId))
      .orderBy(asc(schema.followUps.createdAt));
  }

  async getTodayFollowUps(): Promise<FollowUp[]> {
    const today = new Date().toISOString().split('T')[0];
    return db.select().from(schema.followUps)
      .where(eq(schema.followUps.scheduledDate, today))
      .orderBy(asc(schema.followUps.createdAt));
  }

  async getFollowUpsNeedingReminder(date: string): Promise<FollowUp[]> {
    return db.select().from(schema.followUps)
      .where(
        and(
          eq(schema.followUps.scheduledDate, date),
          eq(schema.followUps.completed, false),
          isNull(schema.followUps.reminderSentAt)
        )
      );
  }

  async getFollowUp(id: string): Promise<FollowUp | undefined> {
    const results = await db.select().from(schema.followUps).where(eq(schema.followUps.id, id));
    return results[0];
  }

  async createFollowUp(followUp: InsertFollowUp): Promise<FollowUp> {
    const results = await db.insert(schema.followUps).values(followUp).returning();
    return results[0];
  }

  async updateFollowUp(id: string, data: Partial<FollowUp>): Promise<FollowUp | undefined> {
    const results = await db.update(schema.followUps).set(data).where(eq(schema.followUps.id, id)).returning();
    return results[0];
  }

  async deleteFollowUp(id: string): Promise<boolean> {
    const result = await db.delete(schema.followUps).where(eq(schema.followUps.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Customers (CRM)
  async getCustomers(search?: string): Promise<Customer[]> {
    if (search) {
      const term = `%${search}%`;
      return db.select().from(schema.customers).where(
        and(
          isNull(schema.customers.deletedAt),
          or(
            ilike(schema.customers.name, term),
            ilike(schema.customers.email, term),
            ilike(schema.customers.phone, term),
            ilike(schema.customers.company, term)
          )
        )
      ).orderBy(desc(schema.customers.updatedAt));
    }
    return db.select().from(schema.customers).where(isNull(schema.customers.deletedAt)).orderBy(desc(schema.customers.updatedAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await db.select().from(schema.customers).where(
      and(eq(schema.customers.id, id), isNull(schema.customers.deletedAt))
    );
    return result[0];
  }

  async findCustomerByEmail(email: string): Promise<Customer | undefined> {
    const result = await db.select().from(schema.customers).where(
      and(eq(schema.customers.email, email), isNull(schema.customers.deletedAt))
    ).limit(1);
    return result[0];
  }

  async findCustomerByPhone(phone: string): Promise<Customer | undefined> {
    const result = await db.select().from(schema.customers).where(
      and(eq(schema.customers.phone, phone), isNull(schema.customers.deletedAt))
    ).limit(1);
    return result[0];
  }

  async findOrCreateCustomer(email: string | null, phone: string | null, name: string): Promise<Customer> {
    // Look up by both email and phone simultaneously to detect potential duplicates early.
    const [byEmail, byPhone] = await Promise.all([
      email ? this.findCustomerByEmail(email) : Promise.resolve(undefined),
      phone ? this.findCustomerByPhone(phone) : Promise.resolve(undefined),
    ]);

    // Case 1: both email AND phone match, but they point to DIFFERENT customer records.
    // This is the classic duplicate scenario — merge the phone-matched record into the
    // email-matched record (keeping the one created earliest), then return the survivor.
    if (byEmail && byPhone && byEmail.id !== byPhone.id) {
      // Prefer the older record as the canonical one to preserve history.
      const keepOlder = (byEmail.createdAt ?? new Date()) <= (byPhone.createdAt ?? new Date());
      const keepCustomer = keepOlder ? byEmail : byPhone;
      const dropCustomer = keepOlder ? byPhone : byEmail;
      await this.mergeCustomers(keepCustomer.id, dropCustomer.id);
      // Ensure the survivor has both email and phone recorded.
      const patch: Partial<InsertCustomer> = {};
      if (!keepCustomer.email && email) patch.email = email;
      if (!keepCustomer.phone && phone) patch.phone = phone;
      if (name && name !== keepCustomer.name && name !== "AI Chat Contact") patch.name = name;
      if (Object.keys(patch).length > 0) {
        const updated = await this.updateCustomer(keepCustomer.id, patch);
        return updated ?? keepCustomer;
      }
      return keepCustomer;
    }

    // Case 2: found by email only — update with phone and/or name if missing.
    if (byEmail) {
      const patch: Partial<InsertCustomer> = {};
      if (!byEmail.phone && phone) patch.phone = phone;
      if (name && name !== byEmail.name && name !== "AI Chat Contact") patch.name = name;
      if (Object.keys(patch).length > 0) {
        const updated = await this.updateCustomer(byEmail.id, patch);
        return updated ?? byEmail;
      }
      return byEmail;
    }

    // Case 3: found by phone only — update with email and/or name if missing.
    if (byPhone) {
      const patch: Partial<InsertCustomer> = {};
      if (!byPhone.email && email) patch.email = email;
      if (name && name !== byPhone.name && name !== "AI Chat Contact") patch.name = name;
      if (Object.keys(patch).length > 0) {
        const updated = await this.updateCustomer(byPhone.id, patch);
        return updated ?? byPhone;
      }
      return byPhone;
    }

    // Case 4: no existing record found — use an upsert keyed on the available unique
    // contact field so a concurrent request racing us to insert the same customer is
    // handled by the DB constraint rather than producing a duplicate row or throwing.
    //
    // If the upsert itself triggers the *other* unique constraint (e.g. we conflict on
    // email but then the coalesced phone clashes with a different row), PostgreSQL raises
    // a 23505 unique violation. We catch that and re-run the full lookup so Cases 1–3
    // can detect and merge the conflicting rows before retrying the insert.
    if (email && email !== '') {
      try {
        const result = await db.insert(schema.customers)
          .values({ id: randomUUID(), name, email, phone: phone ?? undefined })
          .onConflictDoUpdate({
            target: schema.customers.email,
            targetWhere: sql`email IS NOT NULL AND email != '' AND deleted_at IS NULL`,
            set: {
              phone: sql`COALESCE(customers.phone, EXCLUDED.phone)`,
              name: sql`CASE
                WHEN customers.name IS NULL OR customers.name = '' OR customers.name = 'AI Chat Contact'
                THEN COALESCE(NULLIF(EXCLUDED.name, 'AI Chat Contact'), customers.name)
                ELSE customers.name
              END`,
              updatedAt: new Date(),
            },
          })
          .returning();
        return result[0];
      } catch (err: unknown) {
        // 23505 = unique_violation — phone clashed with a different row; re-run the full
        // lookup so the merge logic in Cases 1–3 can reconcile them, then retry once.
        if (isUniqueViolation(err)) {
          return this.findOrCreateCustomer(email, phone, name);
        }
        throw err;
      }
    }

    if (phone && phone !== '') {
      try {
        const result = await db.insert(schema.customers)
          .values({ id: randomUUID(), name, phone })
          .onConflictDoUpdate({
            target: schema.customers.phone,
            targetWhere: sql`phone IS NOT NULL AND phone != '' AND deleted_at IS NULL`,
            set: {
              name: sql`CASE
                WHEN customers.name IS NULL OR customers.name = '' OR customers.name = 'AI Chat Contact'
                THEN COALESCE(NULLIF(EXCLUDED.name, 'AI Chat Contact'), customers.name)
                ELSE customers.name
              END`,
              updatedAt: new Date(),
            },
          })
          .returning();
        return result[0];
      } catch (err: unknown) {
        if (isUniqueViolation(err)) {
          return this.findOrCreateCustomer(null, phone, name);
        }
        throw err;
      }
    }

    // No email or phone — plain insert (no unique constraint applies).
    return this.createCustomer({ name });
  }

  /**
   * Merge `mergeId` into `keepId` inside a single transaction:
   * 1. Coalesce non-null fields from the duplicate into the survivor (no data loss).
   * 2. Re-point all FK references (leads, quotes, ai_conversations, customer_notes).
   * 3. Delete the now-orphaned duplicate row.
   * Safe to call even if `mergeId` has no associated records.
   */
  async mergeCustomers(keepId: string, mergeId: string, triggeredBy?: string): Promise<{ leadsRepointed: number; quotesRepointed: number; convosRepointed: number; historyId: string }> {
    if (keepId === mergeId) return { leadsRepointed: 0, quotesRepointed: 0, convosRepointed: 0, historyId: "" };
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Snapshot both customers before any changes.
      const keepBefore = await client.query<{ name: string; email: string | null; phone: string | null; company: string | null }>(
        `SELECT name, email, phone, company FROM customers WHERE id = $1`, [keepId]
      );
      const removedBefore = await client.query<{ name: string; email: string | null; phone: string | null; company: string | null }>(
        `SELECT name, email, phone, company FROM customers WHERE id = $1`, [mergeId]
      );

      // Snapshot which child records currently belong to the removed customer.
      const leadsRows = await client.query<{ id: string }>(`SELECT id FROM leads WHERE customer_id = $1`, [mergeId]);
      const quotesRows = await client.query<{ id: string }>(`SELECT id FROM quotes WHERE customer_id = $1`, [mergeId]);
      const convosRows = await client.query<{ id: string }>(`SELECT id FROM ai_conversations WHERE customer_id = $1`, [mergeId]);
      const notesRows = await client.query<{ id: string }>(`SELECT id FROM customer_notes WHERE customer_id = $1`, [mergeId]);

      // Coalesce non-null fields from the duplicate into the survivor so no
      // contact data (email, phone, company, name) is silently discarded.
      await client.query(`
        UPDATE customers SET
          email   = COALESCE(email,   (SELECT email   FROM customers WHERE id = $2)),
          phone   = COALESCE(phone,   (SELECT phone   FROM customers WHERE id = $2)),
          company = COALESCE(company, (SELECT company FROM customers WHERE id = $2)),
          name    = CASE
                      WHEN name IS NULL OR name = '' OR name = 'AI Chat Contact'
                      THEN COALESCE((SELECT name FROM customers WHERE id = $2), name)
                      ELSE name
                    END,
          updated_at = NOW()
        WHERE id = $1
      `, [keepId, mergeId]);

      // Re-point all child records to the surviving customer and capture counts.
      const leadsResult = await client.query(`UPDATE leads           SET customer_id = $1 WHERE customer_id = $2`, [keepId, mergeId]);
      const quotesResult = await client.query(`UPDATE quotes          SET customer_id = $1 WHERE customer_id = $2`, [keepId, mergeId]);
      const convosResult = await client.query(`UPDATE ai_conversations SET customer_id = $1 WHERE customer_id = $2`, [keepId, mergeId]);
      await client.query(`UPDATE customer_notes  SET customer_id = $1 WHERE customer_id = $2`, [keepId, mergeId]);

      // Delete the duplicate.
      await client.query(`DELETE FROM customers WHERE id = $1`, [mergeId]);

      // Log the merge history so it can be undone.
      const keepRow = keepBefore.rows[0];
      const removedRow = removedBefore.rows[0];
      const historyInsert = await client.query<{ id: string }>(`
        INSERT INTO customer_merge_history
          (keep_id, keep_snapshot_name, keep_snapshot_email, keep_snapshot_phone, keep_snapshot_company,
           removed_id, removed_snapshot_name, removed_snapshot_email, removed_snapshot_phone, removed_snapshot_company,
           leads_relinked, quotes_relinked, conversations_relinked, notes_relinked, triggered_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `, [
        keepId, keepRow?.name ?? null, keepRow?.email ?? null, keepRow?.phone ?? null, keepRow?.company ?? null,
        mergeId, removedRow?.name ?? null, removedRow?.email ?? null, removedRow?.phone ?? null, removedRow?.company ?? null,
        JSON.stringify(leadsRows.rows.map(r => r.id)),
        JSON.stringify(quotesRows.rows.map(r => r.id)),
        JSON.stringify(convosRows.rows.map(r => r.id)),
        JSON.stringify(notesRows.rows.map(r => r.id)),
        triggeredBy ?? null,
      ]);

      await client.query("COMMIT");
      return {
        leadsRepointed: leadsResult.rowCount ?? 0,
        quotesRepointed: quotesResult.rowCount ?? 0,
        convosRepointed: convosResult.rowCount ?? 0,
        historyId: historyInsert.rows[0]?.id ?? "",
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getMergeHistory(limit = 50, keepId?: string): Promise<CustomerMergeHistory[]> {
    const params: (number | string)[] = [limit];
    const whereClause = keepId ? `WHERE keep_id = $2` : "";
    if (keepId) params.push(keepId);
    const result = await pool.query<CustomerMergeHistory>(`
      SELECT
        id, keep_id AS "keepId",
        keep_snapshot_name AS "keepSnapshotName",
        keep_snapshot_email AS "keepSnapshotEmail",
        keep_snapshot_phone AS "keepSnapshotPhone",
        keep_snapshot_company AS "keepSnapshotCompany",
        removed_id AS "removedId",
        removed_snapshot_name AS "removedSnapshotName",
        removed_snapshot_email AS "removedSnapshotEmail",
        removed_snapshot_phone AS "removedSnapshotPhone",
        removed_snapshot_company AS "removedSnapshotCompany",
        leads_relinked AS "leadsRelinked",
        quotes_relinked AS "quotesRelinked",
        conversations_relinked AS "conversationsRelinked",
        notes_relinked AS "notesRelinked",
        triggered_by AS "triggeredBy",
        split_by AS "splitBy",
        merged_at AS "mergedAt",
        split_at AS "splitAt"
      FROM customer_merge_history
      ${whereClause}
      ORDER BY merged_at DESC
      LIMIT $1
    `, params);
    return result.rows;
  }

  async splitMerge(historyId: string, splitBy?: string): Promise<{ newCustomerId: string }> {
    const histResult = await pool.query<{
      keepId: string;
      removedId: string;
      removedSnapshotName: string | null;
      removedSnapshotEmail: string | null;
      removedSnapshotPhone: string | null;
      removedSnapshotCompany: string | null;
      leadsRelinked: string[];
      quotesRelinked: string[];
      conversationsRelinked: string[];
      notesRelinked: string[];
      splitAt: Date | null;
    }>(`
      SELECT
        keep_id AS "keepId",
        removed_id AS "removedId",
        removed_snapshot_name AS "removedSnapshotName",
        removed_snapshot_email AS "removedSnapshotEmail",
        removed_snapshot_phone AS "removedSnapshotPhone",
        removed_snapshot_company AS "removedSnapshotCompany",
        leads_relinked AS "leadsRelinked",
        quotes_relinked AS "quotesRelinked",
        conversations_relinked AS "conversationsRelinked",
        notes_relinked AS "notesRelinked",
        split_at AS "splitAt"
      FROM customer_merge_history
      WHERE id = $1
    `, [historyId]);

    if (histResult.rows.length === 0) throw new Error("Merge history entry not found");
    const hist = histResult.rows[0];
    if (hist.splitAt) throw new Error("This merge has already been split");

    // Pre-flight: check for duplicate email or phone before attempting the INSERT.
    if (hist.removedSnapshotEmail || hist.removedSnapshotPhone) {
      const conflictResult = await pool.query<{ id: string }>(`
        SELECT id FROM customers
        WHERE ($1::text IS NOT NULL AND email = $1)
           OR ($2::text IS NOT NULL AND phone = $2)
        LIMIT 1
      `, [hist.removedSnapshotEmail ?? null, hist.removedSnapshotPhone ?? null]);
      if (conflictResult.rows.length > 0) {
        throw new Error("A customer with that email or phone already exists. This split cannot be completed.");
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Re-create the removed customer with the original snapshot data.
      const newIdResult = await client.query<{ id: string }>(`
        INSERT INTO customers (name, email, phone, company, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id
      `, [
        hist.removedSnapshotName ?? "Unknown Contact",
        hist.removedSnapshotEmail ?? null,
        hist.removedSnapshotPhone ?? null,
        hist.removedSnapshotCompany ?? null,
      ]);
      const newCustomerId = newIdResult.rows[0].id;

      // Re-point the records that were originally moved from the removed customer.
      const leads: string[] = Array.isArray(hist.leadsRelinked) ? hist.leadsRelinked : [];
      const quotes: string[] = Array.isArray(hist.quotesRelinked) ? hist.quotesRelinked : [];
      const convos: string[] = Array.isArray(hist.conversationsRelinked) ? hist.conversationsRelinked : [];
      const notes: string[] = Array.isArray(hist.notesRelinked) ? hist.notesRelinked : [];

      if (leads.length > 0) {
        await client.query(
          `UPDATE leads SET customer_id = $1 WHERE id = ANY($2::text[])`,
          [newCustomerId, leads]
        );
      }
      if (quotes.length > 0) {
        await client.query(
          `UPDATE quotes SET customer_id = $1 WHERE id = ANY($2::text[])`,
          [newCustomerId, quotes]
        );
      }
      if (convos.length > 0) {
        await client.query(
          `UPDATE ai_conversations SET customer_id = $1 WHERE id = ANY($2::text[])`,
          [newCustomerId, convos]
        );
      }
      if (notes.length > 0) {
        await client.query(
          `UPDATE customer_notes SET customer_id = $1 WHERE id = ANY($2::text[])`,
          [newCustomerId, notes]
        );
      }

      // Mark the history entry as split, recording who triggered it.
      await client.query(
        `UPDATE customer_merge_history SET split_at = NOW(), split_by = $2 WHERE id = $1`,
        [historyId, splitBy ?? null]
      );

      await client.query("COMMIT");
      return { newCustomerId };
    } catch (err) {
      await client.query("ROLLBACK");
      // Remap a unique-constraint violation on email/phone to the same
      // descriptive conflict message so the route can return 409.
      if (
        err instanceof Error &&
        (err as unknown as { code?: string }).code === "23505" &&
        ((err as unknown as { constraint?: string }).constraint?.includes("email") ||
          (err as unknown as { constraint?: string }).constraint?.includes("phone"))
      ) {
        throw new Error("A customer with that email or phone already exists. This split cannot be completed.");
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(schema.customers).values(customer).returning();
    return result[0];
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(schema.customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.customers.id, id))
      .returning();
    return result[0];
  }

  async getCustomerNotes(customerId: string): Promise<CustomerNote[]> {
    return db.select().from(schema.customerNotes)
      .where(eq(schema.customerNotes.customerId, customerId))
      .orderBy(asc(schema.customerNotes.createdAt));
  }

  async createCustomerNote(note: InsertCustomerNote): Promise<CustomerNote> {
    const result = await db.insert(schema.customerNotes).values(note).returning();
    return result[0];
  }

  async deleteCustomer(id: string): Promise<void> {
    // Soft-delete: mark as deleted rather than removing the row.
    // This keeps linked leads/quotes/conversations pointing at this customer_id
    // so the startup backfill (which only processes records WHERE customer_id IS NULL)
    // never recreates the customer from orphaned records.
    await db.execute(sql`UPDATE customers SET deleted_at = NOW() WHERE id = ${id}`);
  }

  private appendReassignmentEntry(
    history: any[],
    fromCustomerId: string,
    toCustomerId: string,
    newEntry: any
  ): any[] {
    const last = history[history.length - 1];
    if (last && last.fromCustomerId === fromCustomerId && last.toCustomerId === toCustomerId) {
      return history;
    }
    return [...history, newEntry];
  }

  async linkLeadToCustomer(leadId: string, customerId: string, staffName?: string): Promise<void> {
    const existing = await pool.query(
      `SELECT l.customer_id, c.name, COALESCE(l.reassignment_history, '[]'::jsonb) AS reassignment_history FROM leads l LEFT JOIN customers c ON c.id = l.customer_id WHERE l.id = $1`,
      [leadId]
    );
    const prev = existing.rows[0];
    const previousName = prev?.customer_id && prev.customer_id !== customerId ? prev.name : null;
    const previousId = prev?.customer_id && prev.customer_id !== customerId ? prev.customer_id : null;
    if (previousName) {
      const newCustomer = await pool.query(`SELECT name FROM customers WHERE id = $1`, [customerId]);
      const toName = newCustomer.rows[0]?.name ?? customerId;
      const history: any[] = prev.reassignment_history ?? [];
      const newEntry: any = {
        fromCustomerName: previousName,
        fromCustomerId: previousId,
        toCustomerName: toName,
        toCustomerId: customerId,
        reassignedAt: new Date().toISOString(),
      };
      if (staffName) newEntry.staffName = staffName;
      const updatedHistory = this.appendReassignmentEntry(history, previousId!, customerId, newEntry);
      await pool.query(
        `UPDATE leads SET customer_id = $1, previous_customer_name = $2, previous_customer_id = $3, reassigned_at = NOW(), reassignment_history = $5::jsonb WHERE id = $4`,
        [customerId, previousName, previousId, leadId, JSON.stringify(updatedHistory)]
      );
    } else {
      await pool.query(`UPDATE leads SET customer_id = $1 WHERE id = $2`, [customerId, leadId]);
    }
  }

  async linkQuoteToCustomer(quoteId: string, customerId: string, staffName?: string): Promise<void> {
    const existing = await pool.query(
      `SELECT q.customer_id, c.name, COALESCE(q.reassignment_history, '[]'::jsonb) AS reassignment_history FROM quotes q LEFT JOIN customers c ON c.id = q.customer_id WHERE q.id = $1`,
      [quoteId]
    );
    const prev = existing.rows[0];
    const previousName = prev?.customer_id && prev.customer_id !== customerId ? prev.name : null;
    const previousId = prev?.customer_id && prev.customer_id !== customerId ? prev.customer_id : null;
    if (previousName) {
      const newCustomer = await pool.query(`SELECT name FROM customers WHERE id = $1`, [customerId]);
      const toName = newCustomer.rows[0]?.name ?? customerId;
      const history: any[] = prev.reassignment_history ?? [];
      const newEntry: any = {
        fromCustomerName: previousName,
        fromCustomerId: previousId,
        toCustomerName: toName,
        toCustomerId: customerId,
        reassignedAt: new Date().toISOString(),
      };
      if (staffName) newEntry.staffName = staffName;
      const updatedHistory = this.appendReassignmentEntry(history, previousId!, customerId, newEntry);
      await pool.query(
        `UPDATE quotes SET customer_id = $1, previous_customer_name = $2, previous_customer_id = $3, reassigned_at = NOW(), reassignment_history = $5::jsonb WHERE id = $4`,
        [customerId, previousName, previousId, quoteId, JSON.stringify(updatedHistory)]
      );
    } else {
      await pool.query(`UPDATE quotes SET customer_id = $1 WHERE id = $2`, [customerId, quoteId]);
    }
  }

  async backfillLeadsAndQuotesForCustomer(customerId: string, email: string | null | undefined, phone: string | null | undefined): Promise<void> {
    const emailVal = email || null;
    const phoneVal = phone || null;
    if (!emailVal && !phoneVal) return;

    const conditions: string[] = [];
    const params: (string)[] = [customerId];

    if (emailVal) {
      params.push(emailVal);
      conditions.push(`email = $${params.length}`);
    }
    if (phoneVal) {
      params.push(phoneVal);
      conditions.push(`phone = $${params.length}`);
    }

    const whereClause = conditions.join(" OR ");
    await pool.query(
      `UPDATE leads SET customer_id = $1 WHERE customer_id IS NULL AND (${whereClause})`,
      params
    );
    await pool.query(
      `UPDATE quotes SET customer_id = $1 WHERE customer_id IS NULL AND (${whereClause})`,
      params
    );

    // Also backfill AI conversations using their contact_email / contact_phone columns
    const convConditions: string[] = [];
    const convParams: (string)[] = [customerId];

    if (emailVal) {
      convParams.push(emailVal);
      convConditions.push(`contact_email = $${convParams.length}`);
    }
    if (phoneVal) {
      convParams.push(phoneVal);
      convConditions.push(`contact_phone = $${convParams.length}`);
    }

    const convWhereClause = convConditions.join(" OR ");
    await pool.query(
      `UPDATE ai_conversations SET customer_id = $1 WHERE customer_id IS NULL AND (${convWhereClause})`,
      convParams
    );
  }

  async linkConversationToCustomer(conversationId: string, customerId: string, staffName?: string): Promise<void> {
    const existing = await pool.query(
      `SELECT a.customer_id, c.name, COALESCE(a.reassignment_history, '[]'::jsonb) AS reassignment_history FROM ai_conversations a LEFT JOIN customers c ON c.id = a.customer_id WHERE a.id = $1`,
      [conversationId]
    );
    const prev = existing.rows[0];
    const previousName = prev?.customer_id && prev.customer_id !== customerId ? prev.name : null;
    const previousId = prev?.customer_id && prev.customer_id !== customerId ? prev.customer_id : null;
    if (previousName) {
      const newCustomer = await pool.query(`SELECT name FROM customers WHERE id = $1`, [customerId]);
      const toName = newCustomer.rows[0]?.name ?? customerId;
      const history: any[] = prev.reassignment_history ?? [];
      const newEntry: any = {
        fromCustomerName: previousName,
        fromCustomerId: previousId,
        toCustomerName: toName,
        toCustomerId: customerId,
        reassignedAt: new Date().toISOString(),
      };
      if (staffName) newEntry.staffName = staffName;
      const updatedHistory = this.appendReassignmentEntry(history, previousId!, customerId, newEntry);
      await pool.query(
        `UPDATE ai_conversations SET customer_id = $1, previous_customer_name = $2, previous_customer_id = $3, reassigned_at = NOW(), reassignment_history = $5::jsonb WHERE id = $4`,
        [customerId, previousName, previousId, conversationId, JSON.stringify(updatedHistory)]
      );
    } else {
      await pool.query(`UPDATE ai_conversations SET customer_id = $1 WHERE id = $2`, [customerId, conversationId]);
    }
  }

  async linkConversationBySessionToCustomer(sessionId: string, customerId: string, staffName?: string): Promise<void> {
    if (staffName) {
      const existing = await pool.query(
        `SELECT a.customer_id, c.name, COALESCE(a.reassignment_history, '[]'::jsonb) AS reassignment_history FROM ai_conversations a LEFT JOIN customers c ON c.id = a.customer_id WHERE a.session_id = $1`,
        [sessionId]
      );
      const prev = existing.rows[0];
      const previousName = prev?.customer_id && prev.customer_id !== customerId ? prev.name : null;
      if (previousName) {
        const currentHistory: Array<{customerName: string; timestamp: string; staffName?: string}> = prev.reassignment_history ?? [];
        const entry: {customerName: string; timestamp: string; staffName?: string} = { customerName: previousName, timestamp: new Date().toISOString(), staffName };
        const updatedHistory = [...currentHistory, entry];
        await pool.query(
          `UPDATE ai_conversations SET customer_id = $1, reassignment_history = $2::jsonb WHERE session_id = $3`,
          [customerId, JSON.stringify(updatedHistory), sessionId]
        );
        return;
      }
    }
    await pool.query(`UPDATE ai_conversations SET customer_id = $1 WHERE session_id = $2`, [customerId, sessionId]);
  }

  // ── Staff Phone Numbers ──────────────────────────────────────────────────────
  // Global list; no per-user filtering. Ordered by sort_order then created_at.
  async getStaffPhones(): Promise<StaffPhone[]> {
    const { rows } = await pool.query(
      `SELECT id, label, phone, sort_order AS "sortOrder", created_at AS "createdAt"
       FROM staff_phone_numbers ORDER BY sort_order ASC, created_at ASC`
    );
    return rows;
  }

  async getStaffPhone(id: string): Promise<StaffPhone | undefined> {
    const { rows } = await pool.query(
      `SELECT id, label, phone, sort_order AS "sortOrder", created_at AS "createdAt"
       FROM staff_phone_numbers WHERE id = $1`,
      [id]
    );
    return rows[0];
  }

  async createStaffPhone(data: InsertStaffPhone): Promise<StaffPhone> {
    const { rows } = await pool.query(
      `INSERT INTO staff_phone_numbers (label, phone, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, label, phone, sort_order AS "sortOrder", created_at AS "createdAt"`,
      [data.label ?? "Mobile", data.phone, data.sortOrder ?? 0]
    );
    return rows[0];
  }

  async updateStaffPhone(id: string, data: Partial<InsertStaffPhone>): Promise<StaffPhone | undefined> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.label !== undefined) { fields.push(`label = $${idx++}`); values.push(data.label); }
    if (data.phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(data.phone); }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(data.sortOrder); }
    if (fields.length === 0) return this.getStaffPhone(id);
    values.push(id);
    const { rows } = await pool.query(
      `UPDATE staff_phone_numbers SET ${fields.join(", ")} WHERE id = $${idx}
       RETURNING id, label, phone, sort_order AS "sortOrder", created_at AS "createdAt"`,
      values
    );
    return rows[0];
  }

  async deleteStaffPhone(id: string): Promise<boolean> {
    const { rowCount } = await pool.query(`DELETE FROM staff_phone_numbers WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  }

  // ── Stock Tracking ──────────────────────────────────────────────────────────
  async getStockItems(): Promise<StockItem[]> {
    const { rows } = await pool.query(
      `SELECT sku, description, on_hand AS "onHand", low_stock_threshold AS "lowStockThreshold", updated_at AS "updatedAt"
       FROM stock_items ORDER BY sku ASC`
    );
    return rows;
  }

  async getStockItem(sku: string): Promise<StockItem | undefined> {
    const { rows } = await pool.query(
      `SELECT sku, description, on_hand AS "onHand", low_stock_threshold AS "lowStockThreshold", updated_at AS "updatedAt"
       FROM stock_items WHERE sku = $1`,
      [sku]
    );
    return rows[0];
  }

  async upsertStockItem(sku: string, data: Partial<InsertStockItem>): Promise<StockItem> {
    // Ensure the row exists first
    await pool.query(
      `INSERT INTO stock_items (sku, updated_at) VALUES ($1, NOW()) ON CONFLICT (sku) DO NOTHING`,
      [sku]
    );
    // Build a targeted UPDATE so we can explicitly set low_stock_threshold to NULL
    const sets: string[] = ['updated_at = NOW()'];
    const vals: any[] = [];
    if (data.description !== undefined) {
      vals.push(data.description);
      sets.push(`description = $${vals.length}`);
    }
    if (data.onHand !== undefined) {
      vals.push(data.onHand);
      sets.push(`on_hand = $${vals.length}`);
    }
    if ('lowStockThreshold' in data) {
      vals.push(data.lowStockThreshold ?? null);
      sets.push(`low_stock_threshold = $${vals.length}`);
    }
    vals.push(sku);
    const { rows } = await pool.query(
      `UPDATE stock_items SET ${sets.join(', ')} WHERE sku = $${vals.length}
       RETURNING sku, description, on_hand AS "onHand", low_stock_threshold AS "lowStockThreshold", updated_at AS "updatedAt"`,
      vals
    );
    return rows[0];
  }

  async deductStock(sku: string, quantity: number, quoteId?: string, buildSheetRef?: string, scannedBySession?: string, kitId?: string, upgradeId?: string): Promise<StockItem> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Ensure the row exists
      await client.query(
        `INSERT INTO stock_items (sku, on_hand, updated_at) VALUES ($1, 0, NOW()) ON CONFLICT (sku) DO NOTHING`,
        [sku]
      );
      // Capture the pre-deduction level so the ledger records what was
      // ACTUALLY deducted — on_hand is clamped at 0, so scanning a part with
      // no stock must log 0 (or the partial amount), not the requested qty.
      const { rows: beforeRows } = await client.query(
        `SELECT on_hand FROM stock_items WHERE sku = $1 FOR UPDATE`,
        [sku]
      );
      const onHandBefore: number = beforeRows[0]?.on_hand ?? 0;
      const actualDeducted = Math.min(Math.max(onHandBefore, 0), quantity);
      const { rows } = await client.query(
        `UPDATE stock_items SET on_hand = GREATEST(on_hand - $2, 0), updated_at = NOW()
         WHERE sku = $1
         RETURNING sku, description, on_hand AS "onHand", low_stock_threshold AS "lowStockThreshold", updated_at AS "updatedAt"`,
        [sku, quantity]
      );
      await client.query(
        `INSERT INTO stock_deductions (sku, quantity_deducted, quote_id, build_sheet_ref, scanned_by_session, kit_id, upgrade_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [sku, actualDeducted, quoteId ?? null, buildSheetRef ?? "", scannedBySession ?? null, kitId ?? null, upgradeId ?? null]
      );
      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async adjustStockDelta(sku: string, delta: number): Promise<StockItem> {
    const { rows } = await pool.query(
      `UPDATE stock_items
       SET on_hand = GREATEST(on_hand + $2, 0), updated_at = NOW()
       WHERE sku = $1
       RETURNING sku, description, on_hand AS "onHand", low_stock_threshold AS "lowStockThreshold", updated_at AS "updatedAt"`,
      [sku, delta]
    );
    if (!rows[0]) throw new Error(`Stock item "${sku}" not found`);
    return rows[0];
  }

  async previewSyncFromBom(): Promise<{ totalBomSkus: number; alreadyTracked: number; newSkus: number }> {
    const { rows: kitRows } = await pool.query(
      `SELECT sku_components FROM kits WHERE sku_components IS NOT NULL AND jsonb_array_length(sku_components) > 0`
    );
    const { rows: upgradeRows } = await pool.query(
      `SELECT sku_components FROM upgrades WHERE sku_components IS NOT NULL AND jsonb_array_length(sku_components) > 0`
    );
    const allComponents = [
      ...kitRows.flatMap((r: any) => (r.sku_components as any[]) || []),
      ...upgradeRows.flatMap((r: any) => (r.sku_components as any[]) || []),
    ];
    const bomSkus = new Set<string>();
    for (const c of allComponents) {
      const s = (c?.sku ?? "").trim();
      if (s) bomSkus.add(s);
    }
    const totalBomSkus = bomSkus.size;
    if (totalBomSkus === 0) return { totalBomSkus: 0, alreadyTracked: 0, newSkus: 0 };
    const skuList = Array.from(bomSkus);
    const { rows: existing } = await pool.query(
      `SELECT sku FROM stock_items WHERE sku = ANY($1::text[])`,
      [skuList]
    );
    const alreadyTracked = existing.length;
    return { totalBomSkus, alreadyTracked, newSkus: totalBomSkus - alreadyTracked };
  }

  async syncStockFromBom(defaultThreshold: number = 2, triggeredBy?: string): Promise<{ synced: number; newSkus: string[] }> {
    const newSkus: string[] = [];
    try {
      const { rows: kitRows } = await pool.query(
        `SELECT sku_components FROM kits WHERE sku_components IS NOT NULL AND jsonb_array_length(sku_components) > 0`
      );
      const { rows: upgradeRows } = await pool.query(
        `SELECT sku_components FROM upgrades WHERE sku_components IS NOT NULL AND jsonb_array_length(sku_components) > 0`
      );
      const allComponents = [
        ...kitRows.flatMap((r: any) => (r.sku_components as any[]) || []),
        ...upgradeRows.flatMap((r: any) => (r.sku_components as any[]) || []),
      ];
      const skuDescMap = new Map<string, string>();
      for (const c of allComponents) {
        const s = (c?.sku ?? "").trim();
        if (s && !skuDescMap.has(s)) {
          skuDescMap.set(s, c.description ?? "");
        }
      }
      for (const [sku, desc] of skuDescMap) {
        const result = await pool.query(
          `INSERT INTO stock_items (sku, description, on_hand, low_stock_threshold, updated_at)
           VALUES ($1, $2, 0, $3, NOW()) ON CONFLICT (sku) DO NOTHING`,
          [sku, desc, defaultThreshold]
        );
        if (result.rowCount && result.rowCount > 0) newSkus.push(sku);
      }
      await this.logBomSync(newSkus.length, triggeredBy);
      return { synced: newSkus.length, newSkus };
    } catch (err: any) {
      const errorMessage = err?.message ?? "Unknown error";
      await this.logBomSync(newSkus.length, triggeredBy, errorMessage).catch(() => {});
      throw err;
    }
  }

  async logBomSync(skusImported: number, triggeredBy?: string, errorMessage?: string): Promise<void> {
    await pool.query(
      `INSERT INTO bom_sync_log (skus_imported, triggered_by, error_message) VALUES ($1, $2, $3)`,
      [skusImported, triggeredBy ?? null, errorMessage ?? null]
    );
    // Keep only the 50 most recent entries
    await pool.query(
      `DELETE FROM bom_sync_log WHERE id NOT IN (
         SELECT id FROM bom_sync_log ORDER BY synced_at DESC LIMIT 50
       )`
    );
  }

  async getBomSyncHistory(limit: number = 20): Promise<Array<{ id: string; syncedAt: Date; skusImported: number; triggeredBy: string | null; errorMessage: string | null }>> {
    const { rows } = await pool.query(
      `SELECT id, synced_at AS "syncedAt", skus_imported AS "skusImported", triggered_by AS "triggeredBy", error_message AS "errorMessage"
       FROM bom_sync_log ORDER BY synced_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async getLowStockCount(): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS count FROM stock_items
       WHERE low_stock_threshold IS NOT NULL AND on_hand <= low_stock_threshold`
    );
    return parseInt(rows[0]?.count ?? "0", 10);
  }

  async getStockDeductionHistory(sku: string, limit = 50): Promise<StockDeduction[]> {
    const { rows } = await pool.query(
      `SELECT id, sku, quantity_deducted AS "quantityDeducted", quote_id AS "quoteId",
              build_sheet_ref AS "buildSheetRef", scanned_by_session AS "scannedBySession",
              kit_id AS "kitId", upgrade_id AS "upgradeId",
              created_at AS "createdAt"
       FROM stock_deductions WHERE sku = $1 ORDER BY created_at DESC LIMIT $2`,
      [sku, limit]
    );
    return rows;
  }
}

export const storage = new DbStorage();
