CREATE TABLE "finance_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"term_months" integer NOT NULL,
	"apr_bps" integer NOT NULL,
	"deposit_percent" integer NOT NULL,
	"balloon_percent" integer,
	"notes" text,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"includes" json DEFAULT '[]'::json NOT NULL,
	"power_kw" numeric NOT NULL,
	"price" integer NOT NULL,
	"images" json DEFAULT '[]'::json NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"published" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"source" text NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"user_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"company" text,
	"van_id" varchar,
	"kit_id" varchar NOT NULL,
	"selected_upgrade_ids" json DEFAULT '[]'::json NOT NULL,
	"selected_upgrades" json DEFAULT '{}'::json NOT NULL,
	"training_option_ids" json DEFAULT '[]'::json NOT NULL,
	"finance_plan_id" varchar,
	"finance_inputs" json,
	"notes" text,
	"est_subtotal" integer NOT NULL,
	"est_vat" integer NOT NULL,
	"est_total" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"build_stage" text,
	"finance_status" text DEFAULT 'pending' NOT NULL,
	"graphics_artwork_url" text,
	"graphics_artwork_approved" boolean DEFAULT false NOT NULL,
	"graphics_artwork_notes" text,
	"customer_logo_urls" json DEFAULT '[]'::json NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_options" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"duration_days" integer NOT NULL,
	"includes" json DEFAULT '[]'::json NOT NULL,
	"price" integer NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "upgrades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"images" json DEFAULT '[]'::json NOT NULL,
	"video_url" text,
	"parent_id" varchar,
	"variant_name" text,
	"allow_quantity" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"published" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar NOT NULL,
	"password_hash" varchar NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "vans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"mileage" integer NOT NULL,
	"price" integer NOT NULL,
	"vat_included" boolean DEFAULT false NOT NULL,
	"specs" json NOT NULL,
	"images" json DEFAULT '[]'::json NOT NULL,
	"hero_image" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"published" boolean DEFAULT true NOT NULL,
	CONSTRAINT "vans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_van_id_vans_id_fk" FOREIGN KEY ("van_id") REFERENCES "public"."vans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_kit_id_kits_id_fk" FOREIGN KEY ("kit_id") REFERENCES "public"."kits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_finance_plan_id_finance_plans_id_fk" FOREIGN KEY ("finance_plan_id") REFERENCES "public"."finance_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upgrades" ADD CONSTRAINT "upgrades_parent_id_upgrades_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."upgrades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_quotes_user_id" ON "quotes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_status" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quotes_build_stage" ON "quotes" USING btree ("build_stage");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");