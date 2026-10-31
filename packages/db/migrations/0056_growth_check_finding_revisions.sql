CREATE TABLE IF NOT EXISTS "growth_check_finding_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"finding_id" uuid NOT NULL REFERENCES "public"."growth_check_findings"("id") ON DELETE cascade,
	"scan_id" uuid NOT NULL REFERENCES "public"."growth_check_scans"("id") ON DELETE cascade,
	"revision" integer NOT NULL,
	"action" varchar(64) NOT NULL,
	"actor_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"reason" text,
	"note" text,
	"previous_state" jsonb NOT NULL,
	"next_state" jsonb NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_finding_revisions_company_idx" ON "growth_check_finding_revisions" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_finding_revisions_finding_idx" ON "growth_check_finding_revisions" USING btree ("finding_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_finding_revisions_scan_idx" ON "growth_check_finding_revisions" USING btree ("scan_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_check_finding_revisions_finding_revision_idx" ON "growth_check_finding_revisions" USING btree ("finding_id","revision");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_check_finding_revisions_company_idempotency_idx" ON "growth_check_finding_revisions" USING btree ("company_id","idempotency_key");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "growth_check_finding_revisions_append_only"() RETURNS trigger AS $$
BEGIN
  -- FK cascades (company/scan/finding delete) and ON DELETE SET NULL on actor are allowed.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'growth_check_finding_revisions is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER "growth_check_finding_revisions_append_only_trg" BEFORE UPDATE OR DELETE ON "growth_check_finding_revisions" FOR EACH ROW EXECUTE FUNCTION "growth_check_finding_revisions_append_only"();
--> statement-breakpoint
ALTER TABLE "growth_check_finding_revisions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "growth_check_finding_revisions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_growth_check_finding_revisions" ON "growth_check_finding_revisions" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
