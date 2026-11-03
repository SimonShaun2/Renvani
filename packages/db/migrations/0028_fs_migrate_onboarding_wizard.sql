DO $$ BEGIN
 CREATE TYPE "public"."import_bundle_status" AS ENUM('active', 'committing', 'completed', 'abandoned');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'import.bundle.created';
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'import.bundle.step_advanced';
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'import.bundle.commit_started';
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'import.bundle.completed';
--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'import.bundle.abandoned';
--> statement-breakpoint
ALTER TABLE "import_bundles" ADD COLUMN IF NOT EXISTS "status" "import_bundle_status" DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "import_bundles" ADD COLUMN IF NOT EXISTS "wizard_step" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "import_bundles" ADD COLUMN IF NOT EXISTS "step_state" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "import_bundles" ADD COLUMN IF NOT EXISTS "dedupe_decisions" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "import_bundles" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "import_bundles" ADD COLUMN IF NOT EXISTS "abandoned_at" timestamp;
--> statement-breakpoint
ALTER TABLE "import_sessions" ADD COLUMN IF NOT EXISTS "import_bundle_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_import_bundle_id_import_bundles_id_fk" FOREIGN KEY ("import_bundle_id") REFERENCES "public"."import_bundles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_bundles_status_idx" ON "import_bundles" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_sessions_bundle_idx" ON "import_sessions" USING btree ("import_bundle_id");
