ALTER TABLE "booking_settings" ADD COLUMN IF NOT EXISTS "customer_self_service_cutoff_hours" integer DEFAULT 24 NOT NULL;
