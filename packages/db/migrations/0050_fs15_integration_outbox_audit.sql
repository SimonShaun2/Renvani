DO $$ BEGIN
  CREATE TYPE "public"."integration_outbox_kind" AS ENUM('csv_import', 'public_booking', 'sms_outbound', 'email_outbound', 'stripe_connect');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."integration_outbox_status" AS ENUM('pending', 'processing', 'succeeded', 'dead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."integration_outbox_audit_event_type" AS ENUM('created', 'processing', 'retry_receipt', 'succeeded', 'dead', 'duplicate_suppressed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_outbox_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" "integration_outbox_kind" NOT NULL,
	"adapter_id" varchar(64) NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"correlation_id" uuid NOT NULL,
	"attribution" jsonb NOT NULL,
	"payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"status" "integration_outbox_status" NOT NULL DEFAULT 'pending',
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integration_outbox_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"outbox_operation_id" uuid NOT NULL,
	"event_type" "integration_outbox_audit_event_type" NOT NULL,
	"retry_receipt_key" varchar(255),
	"receipt" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "integration_outbox_operations" ADD CONSTRAINT "integration_outbox_operations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "integration_outbox_audit_events" ADD CONSTRAINT "integration_outbox_audit_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "integration_outbox_audit_events" ADD CONSTRAINT "integration_outbox_audit_events_outbox_operation_id_fk" FOREIGN KEY ("outbox_operation_id") REFERENCES "public"."integration_outbox_operations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_outbox_operations_company_kind_idempotency_idx" ON "integration_outbox_operations" USING btree ("company_id","kind","idempotency_key") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_outbox_operations_company_correlation_idx" ON "integration_outbox_operations" USING btree ("company_id","correlation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_outbox_audit_events_company_operation_idx" ON "integration_outbox_audit_events" USING btree ("company_id","outbox_operation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_outbox_audit_events_retry_receipt_key_idx" ON "integration_outbox_audit_events" USING btree ("company_id","retry_receipt_key") WHERE "retry_receipt_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_outbox_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integration_outbox_operations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_integration_outbox_operations" ON "integration_outbox_operations";--> statement-breakpoint
CREATE POLICY "tenant_isolation_integration_outbox_operations" ON "integration_outbox_operations" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));--> statement-breakpoint
ALTER TABLE "integration_outbox_audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integration_outbox_audit_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_integration_outbox_audit_events" ON "integration_outbox_audit_events";--> statement-breakpoint
CREATE POLICY "tenant_isolation_integration_outbox_audit_events" ON "integration_outbox_audit_events" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
