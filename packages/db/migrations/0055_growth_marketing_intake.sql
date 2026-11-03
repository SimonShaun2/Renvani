CREATE TABLE IF NOT EXISTS "marketing_demo_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(254) NOT NULL,
	"phone" varchar(20),
	"company" varchar(160) NOT NULL,
	"trade" varchar(32) NOT NULL,
	"message" text,
	"status" varchar(32) DEFAULT 'new' NOT NULL,
	"ip_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_growth_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_url" varchar(2048) NOT NULL,
	"trade" varchar(32) NOT NULL,
	"zip" varchar(5),
	"city" varchar(100),
	"email" varchar(254) NOT NULL,
	"status" varchar(32) DEFAULT 'new' NOT NULL,
	"ip_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_demo_requests_created_at_idx" ON "marketing_demo_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_demo_requests_email_idx" ON "marketing_demo_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_growth_checks_created_at_idx" ON "marketing_growth_checks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_growth_checks_email_idx" ON "marketing_growth_checks" USING btree ("email");
