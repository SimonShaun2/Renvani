-- 0043: customer-paid checkout fees. Additive, defaulted, idempotent; no data rewrite.
-- Service Fee (2%) and $1.99 online-booking fee are stored as separate columns, never folded into
-- invoice total/tax/balance. Fees are non-refundable (fee_refundable = false; refunds capped at amount).
-- RLS: columns only; no new tables, so each table's existing RLS state/policies are unchanged.
-- (payments/invoices are not in the STACK-10 RLS catalog on dev; enabling RLS here without a
-- tenant_isolation policy would deny access, so this migration deliberately leaves RLS as-is.)
-- Rollback (manual): DROP COLUMN IF EXISTS for each column below.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "service_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "booking_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "fee_refundable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amount_refunded" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "service_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "booking_fee_amount" numeric(10, 2) DEFAULT '0' NOT NULL;
