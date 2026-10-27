import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// FS-25 (0049): live cross-tenant check for job_service_briefs, same pattern as the STACK-10
// RLS matrix (runs only when NEON_CI_DATABASE_URL points at Postgres).
const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const postgresIntegrationEnabled = typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");

describe.runIf(postgresIntegrationEnabled)("FS-25 job_service_briefs RLS (Postgres / Neon CI)", () => {
  const RLS_PROBE_ROLE = "fs25_rls_job_brief_probe";
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
    await db.execute(sql.raw(`GRANT SELECT ON job_service_briefs TO ${RLS_PROBE_ROLE}`));
  });

  afterAll(async () => {
    if (createdCompanyIds.length === 0) return;
    const { db } = await import("./client.js");
    const { companies, customers, jobs, jobServiceBriefs } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");
    for (const companyId of createdCompanyIds) {
      await runTransactionWithTenantSession(companyId, async (tx) => {
        await tx.delete(jobServiceBriefs).where(eq(jobServiceBriefs.companyId, companyId));
        await tx.delete(jobs).where(eq(jobs.companyId, companyId));
        await tx.delete(customers).where(eq(customers.companyId, companyId));
      });
    }
    await db.delete(companies).where(inArray(companies.id, createdCompanyIds));
  });

  it("forces RLS with a tenant_isolation policy", async () => {
    const { db } = await import("./client.js");
    const rows = (await db.execute(sql`
      select c.relrowsecurity, c.relforcerowsecurity,
        exists (select 1 from pg_policies p where p.tablename = 'job_service_briefs'
                and p.policyname = 'tenant_isolation_job_service_briefs') as has_policy
      from pg_class c where c.relname = 'job_service_briefs' and c.relkind = 'r'`)) as unknown as Array<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      has_policy: boolean;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, has_policy: true });
  });

  it("denies cross-tenant reads on job_service_briefs", async () => {
    const { db } = await import("./client.js");
    const { companies, customers, jobs, jobServiceBriefs } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");

    const ids: [string, string] = [randomUUID(), randomUUID()];
    createdCompanyIds.push(...ids);
    await db.insert(companies).values(
      ids.map((id) => ({ id, name: `FS25 RLS ${id.slice(0, 8)}`, slug: `fs25-rls-${id}` }))
    );

    const briefIds: Record<string, string> = {};
    for (const companyId of ids) {
      const customerId = randomUUID();
      const jobId = randomUUID();
      briefIds[companyId] = randomUUID();
      await runTransactionWithTenantSession(companyId, async (tx) => {
        await tx.insert(customers).values({
          id: customerId,
          companyId,
          firstName: "Tenant",
          lastName: companyId.slice(0, 4),
          email: `fs25-${companyId.slice(0, 8)}@rls.test`
        });
        await tx.insert(jobs).values({
          id: jobId,
          companyId,
          customerId,
          jobNumber: `FS25-${jobId.slice(0, 8)}`,
          title: "FS-25 RLS job"
        });
        await tx.insert(jobServiceBriefs).values({
          id: briefIds[companyId],
          companyId,
          jobId,
          resourceVersion: "v1"
        });
      });
    }

    const [companyA, companyB] = ids;
    const visible = await runTransactionWithTenantSession(companyA, async (tx) => {
      if (useProbeRole) await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_PROBE_ROLE}`));
      const rows = await tx.select({ id: jobServiceBriefs.id }).from(jobServiceBriefs);
      return rows.map((r) => r.id);
    });

    expect(visible).toContain(briefIds[companyA]);
    expect(visible).not.toContain(briefIds[companyB]);
  });
});
