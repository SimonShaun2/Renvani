import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
// Journal idx 50 (renumbered from 0038 after dev took 0038..0049).
const TAG = "0050_fs15_integration_outbox_audit";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const TABLES = ["integration_outbox_operations", "integration_outbox_audit_events"] as const;

describe("FS-15 integration outbox migration", () => {
  it("is journaled at idx 50 after 0049 and passes the repo migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    const prior = journal.entries.find((e) => e.idx === 49);
    expect(entry?.idx).toBe(50);
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

  it("guards enum types and FKs so the migration is re-runnable", () => {
    expect(sqlText).not.toMatch(/^CREATE TYPE/m);
    expect(sqlText).not.toMatch(/^ALTER TABLE "[^"]+" ADD CONSTRAINT/m);
    expect(sqlText.match(/EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;/g)?.length).toBe(6);
  });

  it("partial unique indexes match schema.ts", () => {
    expect(sqlText).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS "integration_outbox_operations_company_kind_idempotency_idx" ON "integration_outbox_operations" USING btree ("company_id","kind","idempotency_key") WHERE "deleted_at" IS NULL;`
    );
    expect(sqlText).toContain(
      `CREATE UNIQUE INDEX IF NOT EXISTS "integration_outbox_audit_events_retry_receipt_key_idx" ON "integration_outbox_audit_events" USING btree ("company_id","retry_receipt_key") WHERE "retry_receipt_key" IS NOT NULL;`
    );
    const schemaText = readFileSync(join(packageRoot, "src", "schema.ts"), "utf8");
    expect(schemaText).toMatch(
      /uniqueIndex\("integration_outbox_operations_company_kind_idempotency_idx"\)\s*\.on\(t\.companyId, t\.kind, t\.idempotencyKey\)\s*\.where\(sql`"deleted_at" IS NULL`\)/
    );
    expect(schemaText).toMatch(
      /uniqueIndex\("integration_outbox_audit_events_retry_receipt_key_idx"\)\s*\.on\(t\.companyId, t\.retryReceiptKey\)\s*\.where\(sql`"retry_receipt_key" IS NOT NULL`\)/
    );
  });
});
