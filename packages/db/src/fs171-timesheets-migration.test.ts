import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
// Provisional number pending E.. CoS confirmation; journal idx shifts to 45 after 0041–0044 land.
const TAG = "0045_fs171_timesheets_payroll";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const TABLES = ["timesheets", "timesheet_audit_events", "technician_pay_rates"];

describe("FS-171 timesheets/payroll migration", () => {
  it("is journaled and passes the repo migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry).toBeDefined();
    expect(entry!.when).toBeGreaterThan(1777716000000);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it.each(TABLES)("%s has RLS ENABLE + FORCE + tenant_isolation policy", (table) => {
    expect(sqlText).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(
      `CREATE POLICY "tenant_isolation_${table}" ON "${table}" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));`
    );
  });

  it("is additive only (no changes to existing tables) and audit is append-only", () => {
    expect(sqlText).not.toMatch(/^\s*(DROP|DELETE|UPDATE|TRUNCATE|INSERT)\b/im);
    expect(sqlText).not.toMatch(/ALTER TABLE "(?!timesheets"|timesheet_audit_events"|technician_pay_rates")[a-z_]+"/);
    expect(sqlText).toContain('BEFORE UPDATE OR DELETE ON "timesheet_audit_events"');
  });
});
