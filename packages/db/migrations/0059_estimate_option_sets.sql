ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "is_recommended" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "option_set_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "estimates_tier_group_recommended_idx" ON "estimates" USING btree ("company_id","tier_group_id") WHERE "is_recommended" = true AND "deleted_at" IS NULL AND "tier_group_id" IS NOT NULL;
