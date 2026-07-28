-- Indexes for columns the app actually queries but never indexed.
CREATE INDEX IF NOT EXISTS "idx_quotes_confirmation_token" ON "quotes" ("confirmation_token");
CREATE INDEX IF NOT EXISTS "idx_quotes_ai_session_id" ON "quotes" ("ai_session_id");
CREATE INDEX IF NOT EXISTS "idx_quotes_customer_id" ON "quotes" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_quotes_van_id" ON "quotes" ("van_id");
CREATE INDEX IF NOT EXISTS "idx_leads_customer_id" ON "leads" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_ai_conversations_customer_id" ON "ai_conversations" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_ai_conversations_created_at" ON "ai_conversations" ("created_at");
