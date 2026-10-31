CREATE TABLE IF NOT EXISTS "growth_check_report_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"scan_id" uuid NOT NULL REFERENCES "public"."growth_check_scans"("id") ON DELETE cascade,
	"version" integer DEFAULT 1 NOT NULL,
	"content" jsonb NOT NULL,
	"approved_version" integer,
	"approved_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"approved_at" timestamp,
	"created_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_report_drafts_company_idx" ON "growth_check_report_drafts" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_check_report_drafts_company_scan_idx" ON "growth_check_report_drafts" USING btree ("company_id","scan_id");
--> statement-breakpoint
ALTER TABLE "growth_check_report_drafts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "growth_check_report_drafts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_growth_check_report_drafts" ON "growth_check_report_drafts" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_check_report_draft_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"draft_id" uuid NOT NULL REFERENCES "public"."growth_check_report_drafts"("id") ON DELETE cascade,
	"version" integer NOT NULL,
	"action" varchar(64) NOT NULL,
	"actor_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"previous_content" jsonb,
	"next_content" jsonb NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_report_draft_revisions_company_idx" ON "growth_check_report_draft_revisions" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_check_report_draft_revisions_draft_version_idx" ON "growth_check_report_draft_revisions" USING btree ("draft_id","version");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_check_report_draft_revisions_company_idempotency_idx" ON "growth_check_report_draft_revisions" USING btree ("company_id","idempotency_key");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "growth_check_report_draft_revisions_append_only"() RETURNS trigger AS $$
BEGIN
  -- FK cascades (company/draft delete) and ON DELETE SET NULL on actor are allowed.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'growth_check_report_draft_revisions is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER "growth_check_report_draft_revisions_append_only_trg" BEFORE UPDATE OR DELETE ON "growth_check_report_draft_revisions" FOR EACH ROW EXECUTE FUNCTION "growth_check_report_draft_revisions_append_only"();
--> statement-breakpoint
ALTER TABLE "growth_check_report_draft_revisions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "growth_check_report_draft_revisions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_growth_check_report_draft_revisions" ON "growth_check_report_draft_revisions" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_check_report_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"draft_id" uuid NOT NULL REFERENCES "public"."growth_check_report_drafts"("id") ON DELETE cascade,
	"draft_version" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"revoked_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"idempotency_key" varchar(128) NOT NULL,
	"payload_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_report_shares_company_idx" ON "growth_check_report_shares" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_report_shares_draft_idx" ON "growth_check_report_shares" USING btree ("draft_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_check_report_shares_token_hash_idx" ON "growth_check_report_shares" USING btree ("token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_check_report_shares_company_idempotency_idx" ON "growth_check_report_shares" USING btree ("company_id","idempotency_key");
--> statement-breakpoint
ALTER TABLE "growth_check_report_shares" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "growth_check_report_shares" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_growth_check_report_shares" ON "growth_check_report_shares" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
