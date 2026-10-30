ALTER TABLE "estimate_items" ADD COLUMN IF NOT EXISTS "product_catalog_id" uuid;--> statement-breakpoint
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_product_catalog_id_product_catalog_id_fk" FOREIGN KEY ("product_catalog_id") REFERENCES "public"."product_catalog"("id") ON DELETE set null ON UPDATE no action;
