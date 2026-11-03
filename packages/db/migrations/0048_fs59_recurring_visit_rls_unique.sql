-- FS-59 follow-up (#175 review): RLS for recurring visit tables + one active series per plan.
-- 0047 is frozen (already applied on shared CI DB); everything here is guarded and re-runnable.
-- Dedupe + unique index run before RLS is forced so the dedupe sees every tenant's rows.
-- Dedupe-safe: if duplicate active series per plan ever exist, keep the oldest and soft-delete the rest.
DO $$
BEGIN
  UPDATE "recurring_visit_series" AS s
  SET "deleted_at" = now(), "updated_at" = now()
  WHERE s."deleted_at" IS NULL
    AND s."status" = 'active'
    AND s."maintenance_plan_id" IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "recurring_visit_series" AS o
      WHERE o."company_id" = s."company_id"
        AND o."maintenance_plan_id" = s."maintenance_plan_id"
        AND o."status" = 'active'
        AND o."deleted_at" IS NULL
        AND (o."created_at", o."id") < (s."created_at", s."id")
    );
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_visit_series_active_plan_uidx" ON "recurring_visit_series" USING btree ("company_id","maintenance_plan_id") WHERE "status" = 'active' AND "deleted_at" IS NULL AND "maintenance_plan_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "recurring_visit_series" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recurring_visit_series" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_recurring_visit_series" ON "recurring_visit_series";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_recurring_visit_series" ON "recurring_visit_series" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
--> statement-breakpoint
ALTER TABLE "recurring_visit_occurrences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recurring_visit_occurrences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_recurring_visit_occurrences" ON "recurring_visit_occurrences";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_recurring_visit_occurrences" ON "recurring_visit_occurrences" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));
