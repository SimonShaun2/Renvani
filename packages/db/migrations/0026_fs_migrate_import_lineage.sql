DO $$ BEGIN
 CREATE TYPE "public"."agent_action_state" AS ENUM('proposed', 'policy_evaluated', 'awaiting_approval', 'approved', 'executing', 'succeeded', 'failed', 'expired', 'cancelled', 'escalated', 'reversed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."agent_product" AS ENUM('revenue', 'scheduling', 'service', 'retention', 'owner');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."data_export_format" AS ENUM('json', 'csv_bundle');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."data_export_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."field_sync_batch_status" AS ENUM('open', 'completed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."field_sync_operation_outcome" AS ENUM('applied', 'duplicate', 'conflict', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."growth_check_finding_confidence" AS ENUM('high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."growth_check_finding_status" AS ENUM('pass', 'fail', 'warning', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."growth_check_scan_status" AS ENUM('queued', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."growth_intake_audit_action" AS ENUM('created', 'updated', 'deleted');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."growth_intake_audit_entity_type" AS ENUM('growth_intake_check', 'growth_intake_identity_candidate', 'growth_intake_finding');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."growth_intake_check_status" AS ENUM('intake_draft', 'queued', 'scanning', 'review_needed', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."growth_intake_finding_severity" AS ENUM('info', 'low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."growth_intake_finding_status" AS ENUM('open', 'acknowledged', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."growth_intake_identity_source" AS ENUM('manual', 'website', 'google_business', 'facebook', 'import', 'ai');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TYPE "public"."import_chunk_run_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'export.requested' BEFORE 'booking.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'export.completed' BEFORE 'booking.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'export.failed' BEFORE 'booking.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'export.downloaded' BEFORE 'booking.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'export.expired' BEFORE 'booking.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'growth.check_scan_enqueued' BEFORE 'booking.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'growth.check_scan_completed' BEFORE 'booking.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'growth.check_scan_failed' BEFORE 'booking.requested';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'agent.proposal_created';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'agent.proposal_approved';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'agent.proposal_rejected';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'agent.proposal_edited';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'agent.execution_succeeded';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'agent.execution_failed';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'revenue.inquiry_qualified';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'revenue.inquiry_received';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'revenue.inquiry_escalated';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_product" "agent_product" NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target" jsonb NOT NULL,
	"source_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"payload_hash" varchar(128) NOT NULL,
	"policy_version" varchar(64) NOT NULL,
	"requires_approval" boolean NOT NULL,
	"state" "agent_action_state" DEFAULT 'proposed' NOT NULL,
	"confidence" numeric(5, 4),
	"reason" text,
	"expires_at" timestamp NOT NULL,
	"reviewer_id" uuid,
	"approved_parameters" jsonb,
	"execution_receipt" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_export_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"requested_by_id" uuid,
	"status" "data_export_status" DEFAULT 'pending' NOT NULL,
	"format" "data_export_format" DEFAULT 'json' NOT NULL,
	"manifest_version" varchar(64) DEFAULT 'fsm.data-export.v1' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"file_name" varchar(255),
	"file_url" text,
	"record_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp,
	"completed_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_sync_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" varchar(128) NOT NULL,
	"batch_client_id" varchar(128) NOT NULL,
	"status" "field_sync_batch_status" DEFAULT 'open' NOT NULL,
	"last_acknowledged_sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "field_sync_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"client_operation_id" varchar(128) NOT NULL,
	"job_id" uuid NOT NULL,
	"operation_type" varchar(64) NOT NULL,
	"request_payload" jsonb NOT NULL,
	"outcome" "field_sync_operation_outcome" NOT NULL,
	"result_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload_hash" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_check_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"area_id" varchar(64) NOT NULL,
	"check_id" varchar(64) NOT NULL,
	"source_url" text NOT NULL,
	"observed_at" timestamp NOT NULL,
	"status" "growth_check_finding_status" NOT NULL,
	"confidence" "growth_check_finding_confidence" NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_check_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"target_url" text NOT NULL,
	"rubric_id" varchar(64) NOT NULL,
	"rubric_version" varchar(32) NOT NULL,
	"status" "growth_check_scan_status" DEFAULT 'queued' NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_intake_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"entity_type" "growth_intake_audit_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"growth_intake_check_id" uuid,
	"action" "growth_intake_audit_action" NOT NULL,
	"actor_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_intake_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"status" "growth_intake_check_status" DEFAULT 'queued' NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"review_needed" boolean DEFAULT false NOT NULL,
	"last_scan_at" timestamp,
	"business_name" varchar(255) NOT NULL,
	"website_url" varchar(500),
	"industry" varchar(120),
	"trade" varchar(120),
	"city" varchar(100),
	"state" varchar(50),
	"zip" varchar(20),
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(30),
	"target_market" text,
	"google_business_profile_url" varchar(500),
	"facebook_page_url" varchar(500),
	"intake_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_intake_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"growth_intake_check_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"severity" "growth_intake_finding_severity" DEFAULT 'info' NOT NULL,
	"status" "growth_intake_finding_status" DEFAULT 'open' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"recommendation" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "growth_intake_identity_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"growth_intake_check_id" uuid NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"source" "growth_intake_identity_source" DEFAULT 'manual' NOT NULL,
	"confidence_score" numeric(5, 4),
	"is_primary" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "import_bundles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by_id" uuid,
	"source_system" varchar(64) NOT NULL,
	"label" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "import_chunk_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"import_session_id" uuid NOT NULL,
	"entity_type" "import_entity_type" NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunks_total" integer NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"status" "import_chunk_run_status" DEFAULT 'pending' NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb,
	"rows_ok" integer DEFAULT 0,
	"rows_failed" integer DEFAULT 0,
	"error_message" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inquiry_submit_idempotency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"booking_request_id" uuid NOT NULL,
	"response_snapshot" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "import_session_id" uuid;--> statement-breakpoint
ALTER TABLE "import_sessions" ADD COLUMN "import_bundle_id" uuid;--> statement-breakpoint
ALTER TABLE "import_sessions" ADD COLUMN "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "import_sessions" ADD COLUMN "progress" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "import_session_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "import_session_id" uuid;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_export_sessions" ADD CONSTRAINT "data_export_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "data_export_sessions" ADD CONSTRAINT "data_export_sessions_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "field_sync_batches" ADD CONSTRAINT "field_sync_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sync_batches" ADD CONSTRAINT "field_sync_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "field_sync_operations" ADD CONSTRAINT "field_sync_operations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sync_operations" ADD CONSTRAINT "field_sync_operations_batch_id_field_sync_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."field_sync_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "field_sync_operations" ADD CONSTRAINT "field_sync_operations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_check_findings" ADD CONSTRAINT "growth_check_findings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_check_findings" ADD CONSTRAINT "growth_check_findings_scan_id_growth_check_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."growth_check_scans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_check_scans" ADD CONSTRAINT "growth_check_scans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_check_scans" ADD CONSTRAINT "growth_check_scans_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_intake_audit_events" ADD CONSTRAINT "growth_intake_audit_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "growth_intake_audit_events" ADD CONSTRAINT "growth_intake_audit_events_growth_intake_check_id_growth_intake_checks_id_fk" FOREIGN KEY ("growth_intake_check_id") REFERENCES "public"."growth_intake_checks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_intake_audit_events" ADD CONSTRAINT "growth_intake_audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_intake_checks" ADD CONSTRAINT "growth_intake_checks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_intake_checks" ADD CONSTRAINT "growth_intake_checks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_intake_checks" ADD CONSTRAINT "growth_intake_checks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_intake_findings" ADD CONSTRAINT "growth_intake_findings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "growth_intake_findings" ADD CONSTRAINT "growth_intake_findings_growth_intake_check_id_growth_intake_checks_id_fk" FOREIGN KEY ("growth_intake_check_id") REFERENCES "public"."growth_intake_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "growth_intake_identity_candidates" ADD CONSTRAINT "growth_intake_identity_candidates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "growth_intake_identity_candidates" ADD CONSTRAINT "growth_intake_identity_candidates_growth_intake_check_id_growth_intake_checks_id_fk" FOREIGN KEY ("growth_intake_check_id") REFERENCES "public"."growth_intake_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_bundles" ADD CONSTRAINT "import_bundles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_bundles" ADD CONSTRAINT "import_bundles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_chunk_runs" ADD CONSTRAINT "import_chunk_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_chunk_runs" ADD CONSTRAINT "import_chunk_runs_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_submit_idempotency" ADD CONSTRAINT "inquiry_submit_idempotency_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inquiry_submit_idempotency" ADD CONSTRAINT "inquiry_submit_idempotency_booking_request_id_booking_requests_id_fk" FOREIGN KEY ("booking_request_id") REFERENCES "public"."booking_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_actions_company_idempotency_idx" ON "agent_actions" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_actions_company_state_idx" ON "agent_actions" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_export_sessions_company_idx" ON "data_export_sessions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_export_sessions_status_idx" ON "data_export_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "field_sync_batches_device_client_idx" ON "field_sync_batches" USING btree ("company_id","device_id","batch_client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_sync_batches_company_user_idx" ON "field_sync_batches" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "field_sync_operations_company_client_op_idx" ON "field_sync_operations" USING btree ("company_id","client_operation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "field_sync_operations_batch_sequence_idx" ON "field_sync_operations" USING btree ("batch_id","sequence");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_findings_company_idx" ON "growth_check_findings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_findings_scan_idx" ON "growth_check_findings" USING btree ("scan_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_check_findings_scan_check_idx" ON "growth_check_findings" USING btree ("scan_id","check_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_check_scans_company_idx" ON "growth_check_scans" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "growth_check_scans_company_idempotency_idx" ON "growth_check_scans" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_intake_audit_events_company_entity_idx" ON "growth_intake_audit_events" USING btree ("company_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_intake_audit_events_company_check_idx" ON "growth_intake_audit_events" USING btree ("company_id","growth_intake_check_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_intake_checks_company_status_idx" ON "growth_intake_checks" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_intake_checks_company_owner_idx" ON "growth_intake_checks" USING btree ("company_id","owner_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_intake_checks_company_review_idx" ON "growth_intake_checks" USING btree ("company_id","review_needed");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_intake_findings_check_idx" ON "growth_intake_findings" USING btree ("growth_intake_check_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_intake_findings_company_check_idx" ON "growth_intake_findings" USING btree ("company_id","growth_intake_check_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_intake_identity_candidates_check_idx" ON "growth_intake_identity_candidates" USING btree ("growth_intake_check_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "growth_intake_identity_candidates_company_check_idx" ON "growth_intake_identity_candidates" USING btree ("company_id","growth_intake_check_id");--> statement-breakpoint
CREATE INDEX "import_bundles_company_idx" ON "import_bundles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "import_chunk_runs_company_idx" ON "import_chunk_runs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "import_chunk_runs_session_idx" ON "import_chunk_runs" USING btree ("import_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_chunk_runs_idempotency_key_idx" ON "import_chunk_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inquiry_submit_idempotency_company_key_idx" ON "inquiry_submit_idempotency" USING btree ("company_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_submit_idempotency_expires_idx" ON "inquiry_submit_idempotency" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_import_bundle_id_import_bundles_id_fk" FOREIGN KEY ("import_bundle_id") REFERENCES "public"."import_bundles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_import_lineage_idx" ON "assets" USING btree ("company_id","source_system","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_import_lineage_idx" ON "customers" USING btree ("company_id","source_system","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "estimates_import_lineage_idx" ON "estimates" USING btree ("company_id","source_system","source_id");--> statement-breakpoint
CREATE INDEX "import_sessions_bundle_idx" ON "import_sessions" USING btree ("import_bundle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_import_lineage_idx" ON "invoices" USING btree ("company_id","source_system","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_import_lineage_idx" ON "jobs" USING btree ("company_id","source_system","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_import_lineage_idx" ON "payments" USING btree ("company_id","source_system","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_import_lineage_idx" ON "properties" USING btree ("company_id","source_system","source_id");--> statement-breakpoint
ALTER TABLE "product_catalog" ADD COLUMN "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "product_catalog" ADD COLUMN "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "product_catalog" ADD COLUMN "import_session_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "product_catalog_id" uuid;--> statement-breakpoint
ALTER TABLE "product_catalog" ADD CONSTRAINT "product_catalog_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_catalog_id_product_catalog_id_fk" FOREIGN KEY ("product_catalog_id") REFERENCES "public"."product_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_catalog_lineage_company_idx" ON "product_catalog" USING btree ("company_id","source_system","source_id");
