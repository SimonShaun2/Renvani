-- Additive public lead contact details. Existing records and tenant policies are unchanged.
ALTER TABLE "marketing_growth_checks" ADD COLUMN "contact_details" jsonb;
