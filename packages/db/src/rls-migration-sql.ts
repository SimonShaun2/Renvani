import { FS_MIGRATE_RLS_POLICY_CATALOG, type RlsPolicySpec } from "./rls-policy-catalog.js";

const MIGRATION_HEADER =
  "-- STACK-10: tenant RLS policies generated from rls-policy-catalog.ts (do not edit by hand)\n";

export function renderRlsPolicyStatements(policies: RlsPolicySpec[]): string[] {
  const statements: string[] = [];
  for (const policy of policies) {
    statements.push(`ALTER TABLE "${policy.table}" ENABLE ROW LEVEL SECURITY;`);
    statements.push(`ALTER TABLE "${policy.table}" FORCE ROW LEVEL SECURITY;`);
    statements.push(
      `CREATE POLICY "${policy.policyName}" ON "${policy.table}" FOR ALL USING (${policy.usingExpression});`
    );
  }
  return statements;
}

export function renderStack10RlsMigrationSql(): string {
  const body = renderRlsPolicyStatements(FS_MIGRATE_RLS_POLICY_CATALOG).join("\n");
  return `${MIGRATION_HEADER}${body}\n`;
}
