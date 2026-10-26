ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'vip.tier.created';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'vip.tier.updated';--> statement-breakpoint
ALTER TYPE "public"."activity_event_type" ADD VALUE IF NOT EXISTS 'vip.tier.deleted';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vip_membership_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"monthly_price" numeric(10, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"included_visits_per_month" integer,
	"stripe_monthly_price_id" varchar(100),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "vip_membership_tiers" ADD CONSTRAINT "vip_membership_tiers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vip_membership_tiers_company_idx" ON "vip_membership_tiers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vip_membership_tiers_active_idx" ON "vip_membership_tiers" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD COLUMN IF NOT EXISTS "vip_tier_id" uuid;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_vip_tier_id_vip_membership_tiers_id_fk" FOREIGN KEY ("vip_tier_id") REFERENCES "public"."vip_membership_tiers"("id") ON DELETE no action ON UPDATE no action;
