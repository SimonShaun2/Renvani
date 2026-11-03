ALTER TYPE "public"."import_entity_type" ADD VALUE IF NOT EXISTS 'communications';--> statement-breakpoint
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "import_session_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "message_logs_import_lineage_idx" ON "message_logs" USING btree ("company_id","source_system","source_id");
