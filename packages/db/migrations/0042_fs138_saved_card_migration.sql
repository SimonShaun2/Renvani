CREATE TYPE "public"."saved_card_migration_status" AS ENUM('requested', 'awaiting_stripe_import', 'mapping', 'completed', 'failed', 'fallback_required');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_card_migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"import_bundle_id" uuid,
	"created_by_id" uuid,
	"status" "saved_card_migration_status" DEFAULT 'requested' NOT NULL,
	"prior_processor_name" varchar(120) NOT NULL,
	"stripe_import_reference" varchar(255),
	"mapping_summary" jsonb DEFAULT '{"matched":0,"unmatched":0,"failed":0,"total":0}'::jsonb NOT NULL,
	"customer_mappings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_error" text,
	"fallback_email_sent_at" timestamp,
	"fallback_email_customer_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"off_session_consent_acknowledged_at" timestamp,
	"off_session_consent_acknowledged_by_id" uuid,
	"off_session_consent_text_version" varchar(64),
	"off_session_consent_batch_id" uuid,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "saved_card_migrations" ADD CONSTRAINT "saved_card_migrations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_card_migrations" ADD CONSTRAINT "saved_card_migrations_import_bundle_id_import_bundles_id_fk" FOREIGN KEY ("import_bundle_id") REFERENCES "public"."import_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_card_migrations" ADD CONSTRAINT "saved_card_migrations_consent_ack_by_users_id_fk" FOREIGN KEY ("off_session_consent_acknowledged_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_card_migrations" ADD CONSTRAINT "saved_card_migrations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_card_migrations_company_idx" ON "saved_card_migrations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_card_migrations_bundle_idx" ON "saved_card_migrations" USING btree ("import_bundle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_card_migrations_status_idx" ON "saved_card_migrations" USING btree ("status");--> statement-breakpoint
ALTER TABLE "saved_card_migrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "saved_card_migrations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_saved_card_migrations" ON "saved_card_migrations" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'payment_method_migration.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'payment_method_migration.mappings_applied';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'payment_method_migration.stripe_import_confirmed';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'payment_method_migration.completed';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'payment_method_migration.fallback_sent';
