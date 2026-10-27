CREATE TABLE IF NOT EXISTS "timesheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"technician_id" uuid NOT NULL REFERENCES "public"."technicians"("id") ON DELETE cascade,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"submitted_at" timestamp,
	"submitted_by_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"approved_at" timestamp,
	"approved_by_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"rejected_at" timestamp,
	"rejected_by_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "timesheets_status_check" CHECK ("status" IN ('open', 'submitted', 'approved', 'rejected')),
	CONSTRAINT "timesheets_period_check" CHECK ("period_end" >= "period_start")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timesheets_company_idx" ON "timesheets" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "timesheets_company_technician_period_idx" ON "timesheets" USING btree ("company_id","technician_id","period_start");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timesheet_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"timesheet_id" uuid REFERENCES "public"."timesheets"("id") ON DELETE cascade,
	"time_entry_id" uuid REFERENCES "public"."time_entries"("id") ON DELETE cascade,
	"action" varchar(40) NOT NULL,
	"actor_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timesheet_audit_events_company_idx" ON "timesheet_audit_events" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timesheet_audit_events_timesheet_idx" ON "timesheet_audit_events" USING btree ("timesheet_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "timesheet_audit_events_append_only"() RETURNS trigger AS $$
BEGIN
  -- FK cascades / ON DELETE SET NULL are allowed; direct UPDATE/DELETE is not.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'timesheet_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER "timesheet_audit_events_append_only_trg" BEFORE UPDATE OR DELETE ON "timesheet_audit_events" FOR EACH ROW EXECUTE FUNCTION "timesheet_audit_events_append_only"();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "technician_pay_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"technician_id" uuid NOT NULL REFERENCES "public"."technicians"("id") ON DELETE cascade,
	"hourly_rate_cents" integer NOT NULL,
	"effective_from" date NOT NULL,
	"created_by_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "technician_pay_rates_rate_check" CHECK ("hourly_rate_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "technician_pay_rates_company_idx" ON "technician_pay_rates" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "technician_pay_rates_company_technician_effective_idx" ON "technician_pay_rates" USING btree ("company_id","technician_id","effective_from");
--> statement-breakpoint
ALTER TABLE "timesheets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "timesheets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_timesheets" ON "timesheets" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "timesheet_audit_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "timesheet_audit_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_timesheet_audit_events" ON "timesheet_audit_events" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "technician_pay_rates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "technician_pay_rates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_technician_pay_rates" ON "technician_pay_rates" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
-- FS-171 review: at most one open (not ended, not deleted) entry per technician; blocks concurrent double clock-in.
CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_open_technician_idx" ON "time_entries" USING btree ("company_id","technician_id") WHERE "ended_at" IS NULL AND "deleted_at" IS NULL;
