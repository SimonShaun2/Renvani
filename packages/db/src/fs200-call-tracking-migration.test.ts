import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
// Journal idx 57: idx 56 is FS-56 (#346, growth_check_finding_revisions). Merge after #346.
const TAG = "0057_call_tracking";
const TABLES = ["call_tracking_settings", "call_tracking_numbers", "call_records"] as const;
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");

describe("FS-200 call tracking migration", () => {
  it("is journaled at idx 57 with `when` later than every prior entry and passes the safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry?.idx).toBe(57);
    for (const prior of journal.entries.filter((e) => e.idx < 57)) expect(entry!.when).toBeGreaterThan(prior.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it.each(TABLES)("%s has RLS ENABLE + FORCE + tenant_isolation policy", (table) => {
    expect(sqlText).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(
      `CREATE POLICY "tenant_isolation_${table}" ON "${table}" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));`
    );
  });

  it("is additive only and stores no raw caller number or audio", () => {
    expect(sqlText).not.toMatch(/^\s*(DROP|DELETE|UPDATE|TRUNCATE|INSERT)\b/im);
    expect(sqlText).not.toMatch(/ALTER TABLE "(?!call_)[a-z_]+"/);
    expect(sqlText).not.toMatch(/"caller_number"|bytea|"audio/);
    expect(sqlText).toContain(`"caller_hash" varchar(64) NOT NULL`);
    expect(sqlText).toContain(`USING btree ("provider","provider_call_id")`);
  });
});
