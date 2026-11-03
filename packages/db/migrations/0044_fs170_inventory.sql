DO $$ BEGIN
 CREATE TYPE "public"."stock_location_kind" AS ENUM('warehouse', 'van');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."stock_movement_kind" AS ENUM('adjustment', 'transfer_out', 'transfer_in', 'job_usage');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"name" varchar(255) NOT NULL,
	"kind" "stock_location_kind" NOT NULL,
	"technician_id" uuid REFERENCES "public"."technicians"("id") ON DELETE set null,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_locations_company_idx" ON "stock_locations" USING btree ("company_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"location_id" uuid NOT NULL REFERENCES "public"."stock_locations"("id") ON DELETE cascade,
	"product_id" uuid NOT NULL REFERENCES "public"."product_catalog"("id") ON DELETE cascade,
	"quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_levels_company_idx" ON "stock_levels" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_levels_company_location_product_idx" ON "stock_levels" USING btree ("company_id","location_id","product_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"location_id" uuid NOT NULL REFERENCES "public"."stock_locations"("id") ON DELETE cascade,
	"product_id" uuid NOT NULL REFERENCES "public"."product_catalog"("id") ON DELETE cascade,
	"kind" "stock_movement_kind" NOT NULL,
	"quantity_delta" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"reason" text,
	"job_id" uuid REFERENCES "public"."jobs"("id") ON DELETE set null,
	"transfer_group_id" uuid,
	"allow_negative" boolean DEFAULT false NOT NULL,
	"actor_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_company_idx" ON "stock_movements" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_location_product_idx" ON "stock_movements" USING btree ("location_id","product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_movements_job_idx" ON "stock_movements" USING btree ("job_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "stock_movements_append_only"() RETURNS trigger AS $$
BEGIN
  -- FK cascades (company/location/product delete) and ON DELETE SET NULL on job/actor are allowed.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'stock_movements is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER "stock_movements_append_only_trg" BEFORE UPDATE OR DELETE ON "stock_movements" FOR EACH ROW EXECUTE FUNCTION "stock_movements_append_only"();
--> statement-breakpoint
ALTER TABLE "stock_locations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stock_locations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_stock_locations" ON "stock_locations" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "stock_levels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stock_levels" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_stock_levels" ON "stock_levels" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "stock_movements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_stock_movements" ON "stock_movements" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
