import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// FS-59 (0048): live cross-tenant check for recurring visit tables, same pattern as the
// STACK-10 RLS matrix (runs only when NEON_CI_DATABASE_URL points at Postgres).
const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const postgresIntegrationEnabled = typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");

describe.runIf(postgresIntegrationEnabled)("FS-59 recurring visit RLS (Postgres / Neon CI)", () => {
  const RLS_PROBE_ROLE = "fs59_rls_recurring_probe";
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
      sql.raw(`GRANT SELECT ON recurring_visit_series, recurring_visit_occurrences TO ${RLS_PROBE_ROLE}`)
    );
  });

  afterAll(async () => {
    if (createdCompanyIds.length === 0) return;
    const { db } = await import("./client.js");
    const { companies, customers, recurringVisitSeries } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");
    for (const companyId of createdCompanyIds) {
      await runTransactionWithTenantSession(companyId, async (tx) => {
        await tx.delete(recurringVisitSeries).where(eq(recurringVisitSeries.companyId, companyId));
        await tx.delete(customers).where(eq(customers.companyId, companyId));
      });
    }
    await db.delete(companies).where(inArray(companies.id, createdCompanyIds));
  });

  it("forces RLS with tenant_isolation policies on both tables", async () => {
    const { db } = await import("./client.js");
    const rows = (await db.execute(sql`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity,
        exists (select 1 from pg_policies p where p.tablename = c.relname
                and p.policyname = 'tenant_isolation_' || c.relname) as has_policy
      from pg_class c
      where c.relname in ('recurring_visit_series', 'recurring_visit_occurrences') and c.relkind = 'r'
      order by c.relname`)) as unknown as Array<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      has_policy: boolean;
    }>;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, has_policy: true });
    }
  });

  it("denies cross-tenant reads on series and occurrences", async () => {
    const { db } = await import("./client.js");
    const { companies, customers, recurringVisitSeries, recurringVisitOccurrences } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");

    const ids: [string, string] = [randomUUID(), randomUUID()];
    createdCompanyIds.push(...ids);
    await db.insert(companies).values(
      ids.map((id) => ({ id, name: `FS59 RLS ${id.slice(0, 8)}`, slug: `fs59-rls-${id}` }))
    );

    const seriesIds: Record<string, string> = {};
    const occurrenceIds: Record<string, string> = {};
    for (const companyId of ids) {
      const customerId = randomUUID();
      seriesIds[companyId] = randomUUID();
      occurrenceIds[companyId] = randomUUID();
      await runTransactionWithTenantSession(companyId, async (tx) => {
        await tx.insert(customers).values({
          id: customerId,
          companyId,
          firstName: "Tenant",
          lastName: companyId.slice(0, 4),
          email: `fs59-${companyId.slice(0, 8)}@rls.test`
        });
        await tx.insert(recurringVisitSeries).values({
          id: seriesIds[companyId],
          companyId,
          customerId,
          timeZone: "America/Chicago",
          frequency: "monthly",
          anchorLocalDate: "2026-01-31"
        });
        await tx.insert(recurringVisitOccurrences).values({
          id: occurrenceIds[companyId],
          companyId,
          seriesId: seriesIds[companyId]!,
          occurrenceIndex: 0,
          scheduledLocalDate: "2026-01-31",
          scheduledAtUtc: new Date("2026-01-31T15:00:00Z")
        });
      });
    }

    const [companyA, companyB] = ids;
    const visible = await runTransactionWithTenantSession(companyA, async (tx) => {
      if (useProbeRole) await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_PROBE_ROLE}`));
      const series = await tx.select({ id: recurringVisitSeries.id }).from(recurringVisitSeries);
      const occurrences = await tx.select({ id: recurringVisitOccurrences.id }).from(recurringVisitOccurrences);
      return { series: series.map((r) => r.id), occurrences: occurrences.map((r) => r.id) };
    });

    expect(visible.series).toContain(seriesIds[companyA]);
    expect(visible.series).not.toContain(seriesIds[companyB]);
    expect(visible.occurrences).toContain(occurrenceIds[companyA]);
    expect(visible.occurrences).not.toContain(occurrenceIds[companyB]);
  });
});
