import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FS_MIGRATE_RLS_POLICY_CATALOG } from "./rls-policy-catalog.js";
import { renderStack10RlsMigrationSql } from "./rls-migration-sql.js";

const MIGRATION_TAG = "0027_stack10_tenant_rls_policies";

describe("renderStack10RlsMigrationSql", () => {
  it("covers every catalog table with enable RLS + policy", () => {
    const sql = renderStack10RlsMigrationSql();
    for (const policy of FS_MIGRATE_RLS_POLICY_CATALOG) {
      expect(sql).toContain(`ALTER TABLE "${policy.table}" ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE "${policy.table}" FORCE ROW LEVEL SECURITY`);
      expect(sql).toContain(`CREATE POLICY "${policy.policyName}"`);
      expect(sql).toContain(policy.usingExpression);
    }
  });

  it("matches committed migration file", () => {
    const packageRoot = join(import.meta.dirname, "..");
    const migrationPath = join(packageRoot, "migrations", `${MIGRATION_TAG}.sql`);
    const committed = readFileSync(migrationPath, "utf8");
    expect(renderStack10RlsMigrationSql()).toBe(committed);
  });
});
