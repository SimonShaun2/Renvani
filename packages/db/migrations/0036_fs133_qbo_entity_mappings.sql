DO $$ BEGIN
 CREATE TYPE "public"."qbo_mapping_kind" AS ENUM('price_book_item', 'tax_code', 'payment_method');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qbo_entity_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" "qbo_mapping_kind" NOT NULL,
	"local_key" varchar(128) NOT NULL,
	"qbo_id" varchar(64),
	"qbo_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "qbo_entity_mappings" ADD CONSTRAINT "qbo_entity_mappings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qbo_entity_mappings_company_idx" ON "qbo_entity_mappings" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "qbo_entity_mappings_lookup_idx" ON "qbo_entity_mappings" USING btree ("company_id","kind","local_key");
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'integration.qbo_mapping_updated';
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'integration.qbo_sync_retry_requested';
--> statement-breakpoint
ALTER TABLE "qbo_entity_mappings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "qbo_entity_mappings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_qbo_entity_mappings" ON "qbo_entity_mappings" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
