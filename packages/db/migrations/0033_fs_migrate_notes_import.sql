ALTER TYPE "public"."import_entity_type" ADD VALUE IF NOT EXISTS 'notes';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"author_id" uuid,
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT true NOT NULL,
	"noted_at" timestamp,
	"source_system" varchar(64),
	"source_id" varchar(256),
	"import_session_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_notes_company_idx" ON "customer_notes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_notes_customer_idx" ON "customer_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_notes_import_lineage_idx" ON "customer_notes" USING btree ("company_id","source_system","source_id");--> statement-breakpoint
ALTER TABLE "job_notes" ADD COLUMN IF NOT EXISTS "noted_at" timestamp;--> statement-breakpoint
ALTER TABLE "job_notes" ADD COLUMN IF NOT EXISTS "source_system" varchar(64);--> statement-breakpoint
ALTER TABLE "job_notes" ADD COLUMN IF NOT EXISTS "source_id" varchar(256);--> statement-breakpoint
ALTER TABLE "job_notes" ADD COLUMN IF NOT EXISTS "import_session_id" uuid;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_notes_import_lineage_idx" ON "job_notes" USING btree ("company_id","source_system","source_id");
