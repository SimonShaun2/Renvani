-- FS-15 follow-up: integration_outbox_operations.kind enum -> varchar(64) with an app-level kind
-- registry, so new adapter kinds need no migration. Additive and re-runnable; RLS unchanged.
ALTER TABLE "integration_outbox_operations" ALTER COLUMN "kind" SET DATA TYPE varchar(64) USING "kind"::text;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."integration_outbox_kind";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "integration_outbox_operations" ADD CONSTRAINT "integration_outbox_operations_kind_format_chk" CHECK ("kind" ~ '^[a-z][a-z0-9_]{0,63}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_outbox_operations_status_updated_idx" ON "integration_outbox_operations" USING btree ("status","updated_at");
