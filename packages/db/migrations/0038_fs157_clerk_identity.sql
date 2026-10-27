-- FS-157: Clerk identity. Additive and idempotent (safe to re-run).
-- Rollback: DROP INDEX IF EXISTS "companies_clerk_organization_id_idx"; DROP INDEX IF EXISTS "users_clerk_user_id_idx"; then the column may be dropped manually (see PR).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_user_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id") WHERE "clerk_user_id" IS NOT NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "companies"
    WHERE "deleted_at" IS NULL AND ("settings" -> 'clerk' ->> 'organizationId') IS NOT NULL
    GROUP BY ("settings" -> 'clerk' ->> 'organizationId')
    HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'FS-157: duplicate live companies share a Clerk organizationId; companies_clerk_organization_id_idx NOT created. Resolve duplicates and re-run this statement.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "companies_clerk_organization_id_idx" ON "companies" USING btree (("settings" -> 'clerk' ->> 'organizationId')) WHERE "deleted_at" IS NULL AND ("settings" -> 'clerk' ->> 'organizationId') IS NOT NULL;
  END IF;
END $$;
