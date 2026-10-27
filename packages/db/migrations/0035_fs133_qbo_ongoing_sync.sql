DO $$ BEGIN
 CREATE TYPE "public"."qbo_connection_status" AS ENUM('pending', 'connected', 'error', 'disconnected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."qbo_sync_issue_kind" AS ENUM('conflict', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."qbo_sync_direction" AS ENUM('push', 'pull');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."qbo_sync_entity_type" AS ENUM('customer', 'invoice', 'payment');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'integration.qbo_connected';
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'integration.qbo_disconnected';
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'integration.qbo_sync_completed';
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'integration.qbo_sync_failed';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qbo_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"realm_id" varchar(64) NOT NULL,
	"environment" varchar(16) DEFAULT 'sandbox' NOT NULL,
	"status" "qbo_connection_status" DEFAULT 'pending' NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"access_token_expires_at" timestamp NOT NULL,
	"pull_cursor" varchar(128),
	"last_sync_at" timestamp,
	"last_error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "qbo_sync_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"direction" "qbo_sync_direction" NOT NULL,
	"entity_type" "qbo_sync_entity_type" NOT NULL,
	"renvani_entity_id" uuid,
	"qbo_entity_id" varchar(64),
	"kind" "qbo_sync_issue_kind" NOT NULL,
	"code" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "qbo_sync_issues" ADD CONSTRAINT "qbo_sync_issues_connection_id_qbo_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."qbo_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "qbo_sync_issues" ADD CONSTRAINT "qbo_sync_issues_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "qbo_connections_company_idx" ON "qbo_connections" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qbo_connections_realm_idx" ON "qbo_connections" USING btree ("realm_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qbo_sync_issues_company_idx" ON "qbo_sync_issues" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qbo_sync_issues_open_idx" ON "qbo_sync_issues" USING btree ("company_id","resolved_at");
--> statement-breakpoint
ALTER TABLE "qbo_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "qbo_connections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_qbo_connections" ON "qbo_connections" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "qbo_sync_issues" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "qbo_sync_issues" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_qbo_sync_issues" ON "qbo_sync_issues" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
