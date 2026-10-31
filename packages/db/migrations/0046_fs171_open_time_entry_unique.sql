-- FS-171: at most one open (not ended, not deleted) time entry per technician.
-- time_entries has no RLS (0014), so the dedupe sees every tenant's rows. Idempotent: once
-- each technician has at most one open entry the UPDATE matches nothing.
-- Keep the newest open entry (latest started_at, tie-break id); close each older one at the
-- started_at of the next-newer open entry so intervals never overlap or go negative.
WITH ranked AS (
	SELECT "id", "started_at",
		LAG("started_at") OVER (PARTITION BY "company_id", "technician_id" ORDER BY "started_at" DESC, "id" DESC) AS "next_started_at"
	FROM "time_entries"
	WHERE "ended_at" IS NULL AND "deleted_at" IS NULL
)
UPDATE "time_entries" AS te
SET "ended_at" = GREATEST(r."next_started_at", te."started_at"),
	"duration_minutes" = FLOOR(EXTRACT(EPOCH FROM (GREATEST(r."next_started_at", te."started_at") - te."started_at")) / 60)::integer,
	"updated_at" = now()
FROM ranked AS r
WHERE te."id" = r."id" AND r."next_started_at" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_open_technician_idx" ON "time_entries" USING btree ("company_id","technician_id") WHERE "ended_at" IS NULL AND "deleted_at" IS NULL;
