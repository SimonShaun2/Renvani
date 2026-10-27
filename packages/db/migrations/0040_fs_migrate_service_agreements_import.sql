ALTER TYPE "public"."import_entity_type" ADD VALUE IF NOT EXISTS 'service_agreements';--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD COLUMN IF NOT EXISTS "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD COLUMN IF NOT EXISTS "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD COLUMN IF NOT EXISTS "import_session_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_plans_import_lineage_idx" ON "maintenance_plans" USING btree ("company_id","source_system","source_id");
