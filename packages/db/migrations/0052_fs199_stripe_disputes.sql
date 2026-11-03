-- FS-199: Stripe disputes mirror (platform charge.dispute.* webhooks). Additive, re-runnable.
-- status/reason are text + app registry (@fsm/types payouts-disputes), not pgEnum.
CREATE TABLE IF NOT EXISTS "stripe_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"stripe_dispute_id" varchar(100) NOT NULL,
	"stripe_charge_id" varchar(100),
	"stripe_payment_intent_id" varchar(100),
	"payment_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(64) NOT NULL,
	"reason" varchar(64) NOT NULL,
	"evidence_due_by" timestamp,
	"disputed_at" timestamp NOT NULL,
	"resource_version" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stripe_disputes" ADD CONSTRAINT "stripe_disputes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stripe_disputes" ADD CONSTRAINT "stripe_disputes_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stripe_disputes" ADD CONSTRAINT "stripe_disputes_status_format_chk" CHECK ("status" ~ '^[a-z][a-z0-9_]{0,63}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "stripe_disputes" ADD CONSTRAINT "stripe_disputes_reason_format_chk" CHECK ("reason" ~ '^[a-z][a-z0-9_]{0,63}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stripe_disputes_company_dispute_idx" ON "stripe_disputes" USING btree ("company_id","stripe_dispute_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_disputes_company_status_disputed_idx" ON "stripe_disputes" USING btree ("company_id","status","disputed_at");--> statement-breakpoint
ALTER TABLE "stripe_disputes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stripe_disputes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_stripe_disputes" ON "stripe_disputes";--> statement-breakpoint
CREATE POLICY "tenant_isolation_stripe_disputes" ON "stripe_disputes" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
