# STACK-10 — PostgreSQL RLS policy specification

**Owner:** Sam · **Pairs with:** STACK-02 (Clerk org → `company_id` session GUC)

## Session context

Every API/worker DB transaction that serves a tenant request must run:

```sql
SELECT set_config('app.current_company_id', '<company_uuid>', true);
```

Implemented in `@fsm/db` as `buildTenantSessionSetLocal()` and `runTransactionWithTenantSession()` (see `tenant-session.ts`, `run-with-tenant-session.ts`).

## Policy shape

- `USING (company_id::text = current_setting('app.current_company_id', true))`
- `ENABLE` + `FORCE ROW LEVEL SECURITY` on each tenant table
- v1 catalog tables: `customers`, `import_sessions`, `jobs` — see `rls-policy-catalog.ts`
- **Defense in depth** — service layer `companyId` filters remain mandatory

## Migration

| Tag | Notes |
| --- | --- |
| `0027_stack10_tenant_rls_policies` | Generated from catalog via `renderStack10RlsMigrationSql()` |

- Journal idx is **26** on PR #102 until `0026_fs_migrate_import_lineage` merges; then renumber to idx **27** (see [MIGRATION_NUMBERING_REGISTRY](../platform/MIGRATION_NUMBERING_REGISTRY.md)).
- **Neon staging gate** — apply on staging before production; per-PR Neon CI is owned separately (Ezra #110).

## Verification

- **Unit:** `rls-migration-sql.test.ts` (committed SQL matches catalog)
- **STACK-03 matrix** — same cross-tenant cases with session GUC set on DB pool (STACK-02 follow-up)
- **Neon CI matrix:** `rls-policies.integration.test.ts` — cross-tenant deny for every catalog table when `NEON_CI_DATABASE_URL` is set (`pnpm test:neon-ci` locally)
