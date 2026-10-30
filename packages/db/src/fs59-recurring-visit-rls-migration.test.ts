import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
// Journal idx 48. 0047 (tables) is frozen: shared CI DB already applied it.
const TAG = "0048_fs59_recurring_visit_rls_unique";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const TABLES = ["recurring_visit_series", "recurring_visit_occurrences"];

describe("FS-59 recurring visit RLS + unique migration", () => {
  it("is journaled after 0047 and passes the repo migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    const prior = journal.entries.find((e) => e.tag === "0047_fs59_recurring_visit_series");
    expect(entry?.idx).toBe(48);
    expect(prior?.idx).toBe(47);
    expect(entry!.when).toBeGreaterThan(prior!.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it.each(TABLES)("%s has RLS ENABLE + FORCE + tenant_isolation policy (re-runnable)", (table) => {
    expect(sqlText).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`DROP POLICY IF EXISTS "tenant_isolation_${table}" ON "${table}";`);
    expect(sqlText).toContain(
      `CREATE POLICY "tenant_isolation_${table}" ON "${table}" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));`
    );
  });

  it("adds a guarded partial unique index for one active series per plan", () => {
    expect(sqlText).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS "recurring_visit_series_active_plan_uidx" ON "recurring_visit_series" USING btree ("company_id","maintenance_plan_id") WHERE "status" = 'active' AND "deleted_at" IS NULL AND "maintenance_plan_id" IS NOT NULL;`
    );
    expect(sqlText.indexOf("recurring_visit_series_active_plan_uidx")).toBeLessThan(
      sqlText.indexOf("ENABLE ROW LEVEL SECURITY")
    );
    expect(sqlText).not.toMatch(/^\s*(DROP TABLE|DELETE|TRUNCATE)\b/im);
  });
});
