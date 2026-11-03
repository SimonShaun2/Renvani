import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
// Journal idx 49 (renumbered from 0040 after dev took 0040..0048).
const TAG = "0049_fs25_service_agent_job_brief";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const TABLE = "job_service_briefs";

describe("FS-25 service job brief migration", () => {
  it("is journaled at idx 49 after 0048 and passes the repo migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    const prior = journal.entries.find((e) => e.idx === 48);
    expect(entry?.idx).toBe(49);
    expect(entry!.when).toBeGreaterThan(prior!.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("job_service_briefs has RLS ENABLE + FORCE + tenant_isolation policy (re-runnable)", () => {
    expect(sqlText).toContain(`ALTER TABLE "${TABLE}" ENABLE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`ALTER TABLE "${TABLE}" FORCE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`DROP POLICY IF EXISTS "tenant_isolation_${TABLE}" ON "${TABLE}";`);
    expect(sqlText).toContain(
      `CREATE POLICY "tenant_isolation_${TABLE}" ON "${TABLE}" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));`
    );
  });

  it("unique (company_id, job_id) is partial on deleted_at IS NULL, matching schema.ts", () => {
    expect(sqlText).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS "job_service_briefs_company_job_idx" ON "job_service_briefs" USING btree ("company_id","job_id") WHERE "deleted_at" IS NULL;`
    );
    const schemaText = readFileSync(join(packageRoot, "src", "schema.ts"), "utf8");
    expect(schemaText).toContain(
      'uniqueIndex("job_service_briefs_company_job_idx").on(t.companyId, t.jobId).where(sql`"deleted_at" IS NULL`)'
    );
  });
});
