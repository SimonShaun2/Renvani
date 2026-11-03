ALTER TYPE "public"."import_entity_type" ADD VALUE IF NOT EXISTS 'price_book';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_invoice_line_seeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"import_session_id" uuid NOT NULL,
	"source_system" varchar(64) NOT NULL,
	"source_id" varchar(256) NOT NULL,
	"product_catalog_id" uuid NOT NULL,
	"sku" varchar(100),
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "import_invoice_line_seeds" ADD CONSTRAINT "import_invoice_line_seeds_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_invoice_line_seeds" ADD CONSTRAINT "import_invoice_line_seeds_import_session_id_import_sessions_id_fk" FOREIGN KEY ("import_session_id") REFERENCES "public"."import_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_invoice_line_seeds" ADD CONSTRAINT "import_invoice_line_seeds_product_catalog_id_product_catalog_id_fk" FOREIGN KEY ("product_catalog_id") REFERENCES "public"."product_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_invoice_line_seeds_company_idx" ON "import_invoice_line_seeds" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_invoice_line_seeds_session_idx" ON "import_invoice_line_seeds" USING btree ("import_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "import_invoice_line_seeds_lookup_idx" ON "import_invoice_line_seeds" USING btree ("company_id","source_system","source_id");
