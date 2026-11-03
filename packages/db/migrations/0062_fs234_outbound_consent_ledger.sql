CREATE TYPE "public"."outbound_consent_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."outbound_consent_decision" AS ENUM('grant', 'revoke');--> statement-breakpoint
CREATE TYPE "public"."outbound_consent_purpose" AS ENUM('appointment', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."outbound_consent_receipt_surface" AS ENUM('public_inquiry', 'customer_portal', 'operator', 'signed_inbound');--> statement-breakpoint
CREATE TYPE "public"."outbound_consent_state" AS ENUM('granted', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."outbound_consent_subject_type" AS ENUM('customer', 'booking_request');--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE 'outbound_consent.granted' BEFORE 'payment_method_migration.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE 'outbound_consent.revoked' BEFORE 'payment_method_migration.requested';--> statement-breakpoint
CREATE TABLE "outbound_consent_capture_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"subject_type" "outbound_consent_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"channel" "outbound_consent_channel" NOT NULL,
	"purpose" "outbound_consent_purpose" NOT NULL,
	"contact" varchar(320) NOT NULL,
	"decision" "outbound_consent_decision" NOT NULL,
	"explicit_choice" boolean NOT NULL,
	"statement_version" varchar(64) NOT NULL,
	"source_record_id" uuid NOT NULL,
	"source_surface" "outbound_consent_receipt_surface" NOT NULL,
	"actor_type" varchar(30) NOT NULL,
	"actor_id" uuid,
	"signed_inbound_identity" varchar(255),
	"signature_verified_at" timestamp,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"payload_fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "outbound_consent_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"subject_type" "outbound_consent_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"channel" "outbound_consent_channel" NOT NULL,
	"purpose" "outbound_consent_purpose" NOT NULL,
	"contact" varchar(320) NOT NULL,
	"decision" "outbound_consent_decision" NOT NULL,
	"version" bigint NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"source_kind" varchar(64) NOT NULL,
	"source_record_id" uuid NOT NULL,
	"statement_version" varchar(64) NOT NULL,
	"actor_type" varchar(30) NOT NULL,
	"actor_id" uuid,
	"evidence_ref" text NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"decision_fingerprint" varchar(64) NOT NULL,
	"prior_state" "outbound_consent_state",
	"current_state" "outbound_consent_state" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "outbound_consent_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"subject_type" "outbound_consent_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"channel" "outbound_consent_channel" NOT NULL,
	"purpose" "outbound_consent_purpose" NOT NULL,
	"contact" varchar(320) NOT NULL,
	"state" "outbound_consent_state" NOT NULL,
	"version" bigint NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL,
	"source_kind" varchar(64) NOT NULL,
	"source_record_id" uuid NOT NULL,
	"statement_version" varchar(64) NOT NULL,
	"last_event_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "outbound_consent_capture_receipts" ADD CONSTRAINT "outbound_consent_capture_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_consent_events" ADD CONSTRAINT "outbound_consent_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_consent_states" ADD CONSTRAINT "outbound_consent_states_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_consent_capture_receipts_idempotency" ON "outbound_consent_capture_receipts" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "outbound_consent_capture_receipts_subject_idx" ON "outbound_consent_capture_receipts" USING btree ("company_id","subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_consent_events_key_version" ON "outbound_consent_events" USING btree ("company_id","subject_type","subject_id","channel","purpose","contact","version");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_consent_events_idempotency" ON "outbound_consent_events" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "outbound_consent_events_subject_idx" ON "outbound_consent_events" USING btree ("company_id","subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_consent_states_key" ON "outbound_consent_states" USING btree ("company_id","subject_type","subject_id","channel","purpose","contact");--> statement-breakpoint
CREATE INDEX "outbound_consent_states_subject_idx" ON "outbound_consent_states" USING btree ("company_id","subject_type","subject_id");
--> statement-breakpoint
-- Evidence rows are append-only. FORCE RLS also applies to the table owner used by the app.
CREATE OR REPLACE FUNCTION "outbound_consent_evidence_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'outbound consent evidence is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "outbound_consent_receipts_append_only_trg" BEFORE UPDATE OR DELETE ON "outbound_consent_capture_receipts" FOR EACH ROW EXECUTE FUNCTION "outbound_consent_evidence_append_only"();
--> statement-breakpoint
CREATE TRIGGER "outbound_consent_events_append_only_trg" BEFORE UPDATE OR DELETE ON "outbound_consent_events" FOR EACH ROW EXECUTE FUNCTION "outbound_consent_evidence_append_only"();
--> statement-breakpoint
REVOKE UPDATE, DELETE ON "outbound_consent_capture_receipts", "outbound_consent_events" FROM PUBLIC;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "outbound_consent_state_no_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'outbound consent state cannot be deleted';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "outbound_consent_state_no_delete_trg" BEFORE DELETE ON "outbound_consent_states" FOR EACH ROW EXECUTE FUNCTION "outbound_consent_state_no_delete"();
--> statement-breakpoint
REVOKE DELETE ON "outbound_consent_states" FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE "outbound_consent_capture_receipts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outbound_consent_capture_receipts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_select_outbound_consent_capture_receipts" ON "outbound_consent_capture_receipts" FOR SELECT USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
CREATE POLICY "tenant_insert_outbound_consent_capture_receipts" ON "outbound_consent_capture_receipts" FOR INSERT WITH CHECK (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "outbound_consent_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outbound_consent_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_select_outbound_consent_events" ON "outbound_consent_events" FOR SELECT USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
CREATE POLICY "tenant_insert_outbound_consent_events" ON "outbound_consent_events" FOR INSERT WITH CHECK (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "outbound_consent_states" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "outbound_consent_states" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_select_outbound_consent_states" ON "outbound_consent_states" FOR SELECT USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
CREATE POLICY "tenant_insert_outbound_consent_states" ON "outbound_consent_states" FOR INSERT WITH CHECK (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
CREATE POLICY "tenant_update_outbound_consent_states" ON "outbound_consent_states" FOR UPDATE USING (company_id::text = current_setting('app.current_company_id', true)) WITH CHECK (company_id::text = current_setting('app.current_company_id', true));
