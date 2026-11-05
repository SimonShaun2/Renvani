CREATE TABLE IF NOT EXISTS "sms_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" varchar(16) NOT NULL,
	"source" varchar(32) DEFAULT 'twilio_stop' NOT NULL,
	"provider_message_id" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sms_opt_outs_phone_e164_idx" ON "sms_opt_outs" USING btree ("phone_e164");
