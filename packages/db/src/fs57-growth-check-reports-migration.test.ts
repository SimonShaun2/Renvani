import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0058_growth_check_reports";
const TABLES = ["growth_check_report_drafts", "growth_check_report_draft_revisions", "growth_check_report_shares"];
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");

describe("FS-57 growth check reports migration", () => {
  it("is journaled contiguously at idx 58, later than every prior entry, and passes the safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry?.idx).toBe(58);
    journal.entries.forEach((e, index) => expect(e.idx).toBe(index));
    for (const prior of journal.entries.filter((e) => e.idx < 58)) expect(entry!.when).toBeGreaterThan(prior.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it.each(TABLES)("%s has RLS ENABLE + FORCE + tenant_isolation policy", (table) => {
    expect(sqlText).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(
      `CREATE POLICY "tenant_isolation_${table}" ON "${table}" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));`
    );
  });

  it("is additive only, revisions append-only, one draft per scan, hashed unique share token, tenant idempotency", () => {
    expect(sqlText).not.toMatch(/^\s*(DROP|DELETE|UPDATE|TRUNCATE|INSERT)\b/im);
    expect(sqlText).not.toMatch(/ALTER TABLE "(?!growth_check_report_)[a-z_]+"/);
    expect(sqlText).toContain(`BEFORE UPDATE OR DELETE ON "growth_check_report_draft_revisions"`);
    expect(sqlText).toContain(`"growth_check_report_drafts" USING btree ("company_id","scan_id")`);
    expect(sqlText).toContain(`"growth_check_report_shares" USING btree ("token_hash")`);
    expect(sqlText).not.toMatch(/"token"\s/);
    expect(sqlText).toContain(`"growth_check_report_shares" USING btree ("company_id","idempotency_key")`);
    expect(sqlText).toContain(`"growth_check_report_draft_revisions" USING btree ("company_id","idempotency_key")`);
  });
});
