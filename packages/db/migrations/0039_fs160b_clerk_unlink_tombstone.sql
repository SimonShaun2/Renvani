-- FS-160b: Clerk unlink tombstone. Additive and idempotent (safe to re-run); no data changes.
-- Rollback: ALTER TABLE "users" DROP COLUMN IF EXISTS "clerk_unlinked_at"; (manual, see PR).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_unlinked_at" timestamp with time zone;
