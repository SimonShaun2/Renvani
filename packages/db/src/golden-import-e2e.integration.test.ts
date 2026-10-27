import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  GOLDEN_IMPORT_E2E_EXPECTATIONS,
  GOLDEN_IMPORT_E2E_SOURCE_SYSTEMS
} from "./golden-import-e2e/expectations.js";

const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const postgresIntegrationEnabled =
  typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");

describe.runIf(postgresIntegrationEnabled)("FS-152 golden import e2e (Neon CI)", () => {
  /** Companies seeded by this file; deleted in afterAll (tenant rows cascade) so the shared staging DB stays clean. */
  const seededCompanyIds: string[] = [];

  async function seedCompany(): Promise<string> {
    const { seedGoldenE2eCompany } = await import("./golden-import-e2e/pipeline.js");
    const companyId = randomUUID();
    await seedGoldenE2eCompany(companyId);
    seededCompanyIds.push(companyId);
    return companyId;
  }

  beforeAll(() => {
    process.env.DATABASE_URL = neonCiUrl;
    process.env.BOOKING_HOLD_TOKEN_SECRET =
      process.env.BOOKING_HOLD_TOKEN_SECRET ?? "booking_hold_test_secret";
  });

  /**
   * Non-owner, NOBYPASSRLS role used only for the cross-tenant read. The CI/app connection role
   * bypasses RLS (writes do not set app.current_company_id while tenantSessionScopedWrites is off),
   * so querying as that role could never prove isolation. Idempotent; requires CREATEROLE once.
   */
  const RLS_READER_ROLE = "golden_e2e_rls_reader";

  async function ensureRlsReaderRole(): Promise<void> {
    const { sql } = await import("drizzle-orm");
    const { db } = await import("./client.js");
    await db.execute(
      sql.raw(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RLS_READER_ROLE}') THEN
    CREATE ROLE ${RLS_READER_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$`)
    );
    await db.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO ${RLS_READER_ROLE}`));
    await db.execute(sql.raw(`GRANT SELECT ON TABLE customers TO ${RLS_READER_ROLE}`));
    await db.execute(sql.raw(`GRANT ${RLS_READER_ROLE} TO CURRENT_USER`));
  }

  afterAll(async () => {
    const { deleteGoldenE2eCompanies } = await import("./golden-import-e2e/pipeline.js");
    await deleteGoldenE2eCompanies(seededCompanyIds);
  });

  for (const sourceSystem of GOLDEN_IMPORT_E2E_SOURCE_SYSTEMS) {
    it(`runs ${sourceSystem} golden bundle parse → map → commit with lineage`, async () => {
      const { countLineageRows, findLineageRowId, runGoldenImportBundleE2e } = await import(
        "./golden-import-e2e/pipeline.js"
      );

      const companyId = await seedCompany();
      await runGoldenImportBundleE2e(companyId, sourceSystem);

      const expectations = GOLDEN_IMPORT_E2E_EXPECTATIONS[sourceSystem];
      for (const entity of expectations) {
        const count = await countLineageRows(companyId, sourceSystem, entity.table);
        expect(count).toBe(entity.count);

        for (const sourceId of entity.sampleSourceIds) {
          const rowId = await findLineageRowId(companyId, sourceSystem, entity.table, sourceId);
          expect(rowId).toBeTruthy();
        }
      }
    });
  }

  it("denies cross-tenant reads of imported lineage rows through RLS (no explicit company filter)", async () => {
    const { and, eq } = await import("drizzle-orm");
    const { customers } = await import("./schema.js");
    const { findLineageRowId, runGoldenImportBundleE2e } = await import(
      "./golden-import-e2e/pipeline.js"
    );

    const tenantA = await seedCompany();
    const tenantB = await seedCompany();

    await runGoldenImportBundleE2e(tenantA, "service_fusion");
    const tenantARowId = await findLineageRowId(tenantA, "service_fusion", "customers", "SF-CUST-001");
    expect(tenantARowId).toBeTruthy();

    // Deliberately no company_id predicate: only the tenant_isolation_customers policy
    // (app.current_company_id) can hide tenant A's row from tenant B.
    const lineageFilter = and(
      eq(customers.sourceSystem, "service_fusion"),
      eq(customers.sourceId, "SF-CUST-001")
    );

    await ensureRlsReaderRole();
    const { sql } = await import("drizzle-orm");
    const { runTransactionWithRetry } = await import("./transactions.js");

    // As the non-bypass reader role with app.current_company_id set, and deliberately no
    // company_id predicate: only the tenant_isolation_customers policy can hide tenant A's row.
    const readAsTenant = (tenantId: string) =>
      runTransactionWithRetry(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_READER_ROLE}`));
        await tx.execute(sql`select set_config('app.current_company_id', ${tenantId}, true)`);
        return tx
          .select({ id: customers.id, companyId: customers.companyId })
          .from(customers)
          .where(lineageFilter);
      });

    expect(await readAsTenant(tenantB)).toEqual([]);

    // Positive control: the identical query as tenant A returns A's row, so the empty result
    // above is RLS denial rather than a query that can never match.
    const visibleToA = await readAsTenant(tenantA);
    expect(visibleToA.map((row) => row.id)).toContain(tenantARowId);
    expect(visibleToA.every((row) => row.companyId === tenantA)).toBe(true);
  });
});
