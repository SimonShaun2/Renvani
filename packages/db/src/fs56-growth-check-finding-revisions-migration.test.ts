import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0056_growth_check_finding_revisions";
const TABLE = "growth_check_finding_revisions";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");

describe("FS-56 growth check finding revisions migration", () => {
  it("is journaled contiguously at idx 56, later than every prior entry, and passes the safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry?.idx).toBe(56);
    journal.entries.forEach((e, index) => expect(e.idx).toBe(index));
    for (const prior of journal.entries.filter((e) => e.idx < 56)) expect(entry!.when).toBeGreaterThan(prior.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("has RLS ENABLE + FORCE + tenant_isolation policy", () => {
    expect(sqlText).toContain(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(
      `CREATE POLICY "tenant_isolation_${TABLE}" ON "${TABLE}" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));`
    );
  });

  it("is additive only, append-only, and unique per finding revision and tenant idempotency key", () => {
    expect(sqlText).not.toMatch(/^\s*(DROP|DELETE|UPDATE|TRUNCATE|INSERT)\b/im);
    expect(sqlText).not.toMatch(/ALTER TABLE "(?!growth_check_finding_revisions)[a-z_]+"/);
    expect(sqlText).toContain(`BEFORE UPDATE OR DELETE ON "${TABLE}"`);
    expect(sqlText).toContain(`USING btree ("finding_id","revision")`);
    expect(sqlText).toContain(`USING btree ("company_id","idempotency_key")`);
  });
});
