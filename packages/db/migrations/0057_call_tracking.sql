CREATE TABLE IF NOT EXISTS "call_tracking_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"provider" varchar(64) DEFAULT 'disabled' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"recording_enabled" boolean DEFAULT false NOT NULL,
	"recording_disclosure_enabled" boolean DEFAULT true NOT NULL,
	"consent_mode" varchar(32) DEFAULT 'all_party' NOT NULL,
	"recording_notice_state" varchar(2),
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_user_id" uuid REFERENCES "public"."users"("id") ON DELETE set null,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "call_tracking_settings_company_idx" ON "call_tracking_settings" USING btree ("company_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_tracking_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"provider" varchar(64) NOT NULL,
	"provider_number_id" varchar(128),
	"tracking_number" varchar(20) NOT NULL,
	"label" varchar(100) NOT NULL,
	"marketing_source" varchar(64) NOT NULL,
	"marketing_campaign" varchar(100),
	"forwarding_number" varchar(20) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_tracking_numbers_company_idx" ON "call_tracking_numbers" USING btree ("company_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "call_tracking_numbers_tracking_number_idx" ON "call_tracking_numbers" USING btree ("tracking_number") WHERE "call_tracking_numbers"."deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE cascade,
	"tracking_number_id" uuid NOT NULL REFERENCES "public"."call_tracking_numbers"("id") ON DELETE cascade,
	"provider" varchar(64) NOT NULL,
	"provider_call_id" varchar(128) NOT NULL,
	"caller_hash" varchar(64) NOT NULL,
	"caller_last4" varchar(4) NOT NULL,
	"started_at" timestamp NOT NULL,
	"duration_seconds" integer NOT NULL,
	"outcome" varchar(32) NOT NULL,
	"lead_attribution" jsonb,
	"recording_ref" varchar(512),
	"recording_disclosure_played" boolean DEFAULT false NOT NULL,
	"caller_consent" varchar(32) DEFAULT 'unknown' NOT NULL,
	"recording_notice_state" varchar(2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_records_company_started_idx" ON "call_records" USING btree ("company_id","started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "call_records_tracking_number_idx" ON "call_records" USING btree ("tracking_number_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "call_records_provider_call_idx" ON "call_records" USING btree ("provider","provider_call_id");
--> statement-breakpoint
ALTER TABLE "call_tracking_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "call_tracking_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_call_tracking_settings" ON "call_tracking_settings" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "call_tracking_numbers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "call_tracking_numbers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_call_tracking_numbers" ON "call_tracking_numbers" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "call_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "call_records" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_call_records" ON "call_records" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
