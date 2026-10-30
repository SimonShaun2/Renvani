CREATE TABLE IF NOT EXISTS "crews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(16),
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crew_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"crew_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "crew_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crews" ADD CONSTRAINT "crews_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "crew_members" ADD CONSTRAINT "crew_members_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crews_company_idx" ON "crews" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crews_company_name_idx" ON "crews" USING btree ("company_id","name") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crew_members_company_idx" ON "crew_members" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crew_members_technician_idx" ON "crew_members" USING btree ("technician_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crew_members_crew_technician_idx" ON "crew_members" USING btree ("crew_id","technician_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_crew_idx" ON "jobs" USING btree ("crew_id");
--> statement-breakpoint
ALTER TABLE "crews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crews" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_crews" ON "crews";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_crews" ON "crews" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "crew_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "crew_members" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_crew_members" ON "crew_members";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_crew_members" ON "crew_members" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
