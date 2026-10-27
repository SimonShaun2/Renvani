CREATE TYPE "public"."recurring_visit_series_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recurring_visit_occurrence_status" AS ENUM('scheduled', 'completed', 'cancelled', 'skipped');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring_visit_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"property_id" uuid,
	"maintenance_plan_id" uuid,
	"anchor_maintenance_visit_id" uuid,
	"time_zone" varchar(64) NOT NULL,
	"frequency" "maintenance_plan_frequency" NOT NULL,
	"anchor_local_date" date NOT NULL,
	"local_time" varchar(8) DEFAULT '09:00' NOT NULL,
	"status" "recurring_visit_series_status" DEFAULT 'active' NOT NULL,
	"external_scheduler_authoritative" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring_visit_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"series_id" uuid NOT NULL,
	"occurrence_index" integer NOT NULL,
	"scheduled_local_date" date NOT NULL,
	"scheduled_at_utc" timestamp NOT NULL,
	"status" "recurring_visit_occurrence_status" DEFAULT 'scheduled' NOT NULL,
	"override_scheduled_local_date" date,
	"override_notes" text,
	"maintenance_visit_id" uuid,
	"job_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "recurring_visit_series" ADD CONSTRAINT "recurring_visit_series_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_series" ADD CONSTRAINT "recurring_visit_series_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_series" ADD CONSTRAINT "recurring_visit_series_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_series" ADD CONSTRAINT "recurring_visit_series_maintenance_plan_id_maintenance_plans_id_fk" FOREIGN KEY ("maintenance_plan_id") REFERENCES "public"."maintenance_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_series" ADD CONSTRAINT "recurring_visit_series_anchor_maintenance_visit_id_maintenance_visits_id_fk" FOREIGN KEY ("anchor_maintenance_visit_id") REFERENCES "public"."maintenance_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_occurrences" ADD CONSTRAINT "recurring_visit_occurrences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_occurrences" ADD CONSTRAINT "recurring_visit_occurrences_series_id_recurring_visit_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."recurring_visit_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_occurrences" ADD CONSTRAINT "recurring_visit_occurrences_maintenance_visit_id_maintenance_visits_id_fk" FOREIGN KEY ("maintenance_visit_id") REFERENCES "public"."maintenance_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_visit_occurrences" ADD CONSTRAINT "recurring_visit_occurrences_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_visit_occurrences_series_index_uidx" ON "recurring_visit_occurrences" USING btree ("series_id","occurrence_index") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_visit_series_company_idx" ON "recurring_visit_series" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_visit_occurrences_company_series_idx" ON "recurring_visit_occurrences" USING btree ("company_id","series_id");
