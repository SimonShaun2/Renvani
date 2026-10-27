import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FS_MIGRATE_RLS_POLICY_CATALOG } from "./rls-policy-catalog.js";

const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const postgresIntegrationEnabled =
  typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");

const RLS_MATRIX_TABLES = FS_MIGRATE_RLS_POLICY_CATALOG.map((policy) => policy.table);

describe("STACK-10 RLS Neon CI matrix (catalog coverage)", () => {
  it("integration suite exercises every catalog table", () => {
    expect(RLS_MATRIX_TABLES).toEqual(
      ["customers", "import_sessions", "jobs"].sort((a, b) => a.localeCompare(b))
    );
  });
});

describe.runIf(postgresIntegrationEnabled)("STACK-10 RLS policies (Postgres / Neon CI)", () => {
  // The staging Neon branch is shared by every PR run, so each test creates its own
  // uniquely-id'd companies (customers/import_sessions/jobs FK to companies) and
  // afterAll removes them even when assertions fail. Tenant rows are written inside
  // runTransactionWithTenantSession (SET LOCAL via set_config(..., true) on one
  // transaction/connection), so FORCE RLS WITH CHECK passes and pooled connections
  // never carry tenant state between statements.
  // Neon branch owner roles have BYPASSRLS (that is why the old setup reached the FK
  // check instead of the RLS check), so reads assert under a NOBYPASSRLS probe role
  // via SET LOCAL ROLE. Idempotent and safe to race across concurrent PR runs.
  const RLS_PROBE_ROLE = "fs_rls_matrix_probe";
  const createdCompanyIds: string[] = [];
  let useProbeRole = false;

  beforeAll(async () => {
    process.env.DATABASE_URL = neonCiUrl;
    process.env.BOOKING_HOLD_TOKEN_SECRET =
      process.env.BOOKING_HOLD_TOKEN_SECRET ?? "booking_hold_test_secret";
    const { db } = await import("./client.js");
    const [self] = (await db.execute(
      sql`select rolbypassrls from pg_roles where rolname = current_user`
    )) as unknown as { rolbypassrls: boolean }[];
    useProbeRole = self?.rolbypassrls === true;
    if (!useProbeRole) return;
    await db.execute(
      sql.raw(`DO $$ BEGIN
        CREATE ROLE ${RLS_PROBE_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
      EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$`)
    );
    await db.execute(sql.raw(`GRANT ${RLS_PROBE_ROLE} TO CURRENT_USER`));
    await db.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO ${RLS_PROBE_ROLE}`));
    await db.execute(
      sql.raw(`GRANT SELECT ON customers, import_sessions, jobs TO ${RLS_PROBE_ROLE}`)
    );
  });

  async function readAsTenant<T>(
    companyId: string,
    read: Parameters<typeof import("./run-with-tenant-session.js")["runTransactionWithTenantSession"]>[1]
  ): Promise<T> {
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");
    return runTransactionWithTenantSession(companyId, async (tx) => {
      if (useProbeRole) await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_PROBE_ROLE}`));
      return read(tx);
    }) as Promise<T>;
  }

  async function createTestCompanies(): Promise<[string, string]> {
    const { db } = await import("./client.js");
    const { companies } = await import("./schema.js");
    const ids: [string, string] = [randomUUID(), randomUUID()];
    createdCompanyIds.push(...ids);
    await db.insert(companies).values(
      ids.map((id) => ({ id, name: `RLS matrix ${id.slice(0, 8)}`, slug: `rls-matrix-${id}` }))
    );
    return ids;
  }

  async function insertAsOwningTenant<TRow extends { companyId: string }>(
    table: Parameters<typeof import("./client.js")["db"]["insert"]>[0],
    rows: TRow[]
  ): Promise<void> {
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");
    for (const row of rows) {
      await runTransactionWithTenantSession(row.companyId, async (tx) => {
        await tx.insert(table).values(row as never);
      });
    }
  }

  afterAll(async () => {
    if (createdCompanyIds.length === 0) return;
    const { db } = await import("./client.js");
    const { companies, customers, importSessions, jobs } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");
    for (const companyId of createdCompanyIds) {
      await runTransactionWithTenantSession(companyId, async (tx) => {
        await tx.delete(jobs).where(eq(jobs.companyId, companyId));
        await tx.delete(customers).where(eq(customers.companyId, companyId));
        await tx.delete(importSessions).where(eq(importSessions.companyId, companyId));
      });
    }
    await db.delete(companies).where(inArray(companies.id, createdCompanyIds));
  });

  it("denies cross-tenant reads on customers when session GUC is set", async () => {
    const { customers } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");

    const [companyA, companyB] = await createTestCompanies();
    const customerA = randomUUID();
    const customerB = randomUUID();

    await insertAsOwningTenant(customers, [
      {
        id: customerA,
        companyId: companyA,
        firstName: "Tenant",
        lastName: "A",
        email: `a-${companyA.slice(0, 8)}@rls.test`
      },
      {
        id: customerB,
        companyId: companyB,
        firstName: "Tenant",
        lastName: "B",
        email: `b-${companyB.slice(0, 8)}@rls.test`
      }
    ]);

    const visibleForA = await readAsTenant<{ id: string }[]>(companyA, async (tx) =>
      tx.select({ id: customers.id }).from(customers)
    );

    const idsForA = visibleForA.map((row) => row.id);
    expect(idsForA).toContain(customerA);
    expect(idsForA).not.toContain(customerB);

    await runTransactionWithTenantSession(companyA, async (tx) => {
      await tx.delete(customers).where(eq(customers.id, customerA));
    });
    await runTransactionWithTenantSession(companyB, async (tx) => {
      await tx.delete(customers).where(eq(customers.id, customerB));
    });
  });

  it("denies cross-tenant reads on import_sessions when session GUC is set", async () => {
    const { importSessions } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");

    const [companyA, companyB] = await createTestCompanies();
    const sessionA = randomUUID();
    const sessionB = randomUUID();

    await insertAsOwningTenant(importSessions, [
      {
        id: sessionA,
        companyId: companyA,
        entityType: "customers",
        fileName: "a.csv",
        fileUrl: "https://example.test/a.csv"
      },
      {
        id: sessionB,
        companyId: companyB,
        entityType: "customers",
        fileName: "b.csv",
        fileUrl: "https://example.test/b.csv"
      }
    ]);

    const visibleForA = await readAsTenant<{ id: string }[]>(companyA, async (tx) =>
      tx.select({ id: importSessions.id }).from(importSessions)
    );

    const idsForA = visibleForA.map((row) => row.id);
    expect(idsForA).toContain(sessionA);
    expect(idsForA).not.toContain(sessionB);

    await runTransactionWithTenantSession(companyA, async (tx) => {
      await tx.delete(importSessions).where(eq(importSessions.id, sessionA));
    });
    await runTransactionWithTenantSession(companyB, async (tx) => {
      await tx.delete(importSessions).where(eq(importSessions.id, sessionB));
    });
  });

  it("denies cross-tenant reads on jobs when session GUC is set", async () => {
    const { customers, jobs } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");

    const [companyA, companyB] = await createTestCompanies();
    const customerA = randomUUID();
    const customerB = randomUUID();
    const jobA = randomUUID();
    const jobB = randomUUID();

    await insertAsOwningTenant(customers, [
      {
        id: customerA,
        companyId: companyA,
        firstName: "Job",
        lastName: "A",
        email: `job-a-${companyA.slice(0, 8)}@rls.test`
      },
      {
        id: customerB,
        companyId: companyB,
        firstName: "Job",
        lastName: "B",
        email: `job-b-${companyB.slice(0, 8)}@rls.test`
      }
    ]);

    await insertAsOwningTenant(jobs, [
      {
        id: jobA,
        companyId: companyA,
        customerId: customerA,
        jobNumber: `RLS-A-${jobA.slice(0, 8)}`,
        title: "RLS job A"
      },
      {
        id: jobB,
        companyId: companyB,
        customerId: customerB,
        jobNumber: `RLS-B-${jobB.slice(0, 8)}`,
        title: "RLS job B"
      }
    ]);

    const visibleForA = await readAsTenant<{ id: string }[]>(companyA, async (tx) =>
      tx.select({ id: jobs.id }).from(jobs)
    );

    const idsForA = visibleForA.map((row) => row.id);
    expect(idsForA).toContain(jobA);
    expect(idsForA).not.toContain(jobB);

    await runTransactionWithTenantSession(companyA, async (tx) => {
      await tx.delete(jobs).where(eq(jobs.id, jobA));
      await tx.delete(customers).where(eq(customers.id, customerA));
    });
    await runTransactionWithTenantSession(companyB, async (tx) => {
      await tx.delete(jobs).where(eq(jobs.id, jobB));
      await tx.delete(customers).where(eq(customers.id, customerB));
    });
  });
});
