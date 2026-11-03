ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "lead_attribution" jsonb;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "lead_attribution" jsonb;
