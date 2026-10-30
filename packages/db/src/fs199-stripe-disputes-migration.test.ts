import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";
import { TENANT_SESSION_GUC } from "./tenant-session.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0052_fs199_stripe_disputes";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const schemaText = readFileSync(join(packageRoot, "src", "schema.ts"), "utf8");

describe("FS-199 stripe_disputes migration", () => {
  it("is journaled contiguously after 0050 and passes the migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG)!;
    const prior = journal.entries.find((e) => e.idx === entry.idx - 1)!;
    expect(entry.idx).toBe(52);
    expect(entry.when).toBe(1792722000000);
    expect(entry.when).toBeGreaterThan(prior.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("is additive, guarded and re-runnable with forced tenant RLS", () => {
    expect(sqlText).toContain(`CREATE TABLE IF NOT EXISTS "stripe_disputes"`);
    expect(sqlText).not.toMatch(/CREATE TYPE|DROP TABLE|DROP COLUMN/);
    expect(sqlText).toContain(`ALTER TABLE "stripe_disputes" ENABLE ROW LEVEL SECURITY`);
    expect(sqlText).toContain(`ALTER TABLE "stripe_disputes" FORCE ROW LEVEL SECURITY`);
    expect(sqlText).toContain(`DROP POLICY IF EXISTS "tenant_isolation_stripe_disputes" ON "stripe_disputes"`);
    expect(sqlText).toContain(TENANT_SESSION_GUC);
    expect((sqlText.match(/EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;/g) ?? []).length).toBe(4);
  });

  it("schema.ts mirrors the partial unique index, checks and text status (no pgEnum)", () => {
    expect(sqlText).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS "stripe_disputes_company_dispute_idx" ON "stripe_disputes" USING btree ("company_id","stripe_dispute_id") WHERE "deleted_at" IS NULL;`
    );
    expect(schemaText).toMatch(
      /uniqueIndex\("stripe_disputes_company_dispute_idx"\)\s*\.on\(t\.companyId, t\.stripeDisputeId\)\s*\.where\(sql`"deleted_at" IS NULL`\)/
    );
    expect(schemaText).toContain('status: varchar("status", { length: 64 }).notNull()');
    expect(schemaText).toContain(`check("stripe_disputes_status_format_chk", sql\`"status" ~ '^[a-z][a-z0-9_]{0,63}$'\`)`);
    expect(sqlText).toContain(`CHECK ("status" ~ '^[a-z][a-z0-9_]{0,63}$')`);
    expect(schemaText).toContain('index("stripe_disputes_company_status_disputed_idx").on(t.companyId, t.status, t.disputedAt)');
  });
});
