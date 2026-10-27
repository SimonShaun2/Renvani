CREATE TYPE "public"."job_note_kind" AS ENUM('internal', 'field');--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'job.service_brief.proposed';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'job.service_brief.approved';--> statement-breakpoint
ALTER TABLE "job_notes" ADD COLUMN IF NOT EXISTS "note_kind" "job_note_kind" DEFAULT 'internal' NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_service_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checklist_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resource_version" varchar(128) NOT NULL,
	"approved_agent_action_id" uuid,
	"approved_by_id" uuid,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "job_service_briefs" ADD CONSTRAINT "job_service_briefs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_service_briefs" ADD CONSTRAINT "job_service_briefs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_service_briefs" ADD CONSTRAINT "job_service_briefs_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_service_briefs_company_job_idx" ON "job_service_briefs" USING btree ("company_id","job_id");
