import { randomUUID } from "node:crypto";

import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// FS-195 (0053): live cross-tenant check for crews + crew_members (runs only when NEON_CI_DATABASE_URL is Postgres).
const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const postgresIntegrationEnabled = typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");

describe.runIf(postgresIntegrationEnabled)("FS-195 crews RLS (Postgres / Neon CI)", () => {
  const RLS_PROBE_ROLE = "fs195_rls_crews_probe";
  const createdCompanyIds: string[] = [];
  let useProbeRole = false;

  beforeAll(async () => {
    process.env.DATABASE_URL = neonCiUrl;
    process.env.BOOKING_HOLD_TOKEN_SECRET = process.env.BOOKING_HOLD_TOKEN_SECRET ?? "booking_hold_test_secret";
    const { db } = await import("./client.js");
    const [self] = (await db.execute(sql`select rolbypassrls, rolsuper from pg_roles where rolname = current_user`)) as unknown as { rolbypassrls: boolean; rolsuper: boolean }[];
    // Superusers and BYPASSRLS roles skip policies, so probe through a NOBYPASSRLS role.
    useProbeRole = self?.rolbypassrls === true || self?.rolsuper === true;
    if (!useProbeRole) return;
    await db.execute(sql.raw(`DO $$ BEGIN
        CREATE ROLE ${RLS_PROBE_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
      EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$`));
    await db.execute(sql.raw(`GRANT ${RLS_PROBE_ROLE} TO CURRENT_USER`));
    await db.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO ${RLS_PROBE_ROLE}`));
    await db.execute(sql.raw(`GRANT SELECT ON crews, crew_members TO ${RLS_PROBE_ROLE}`));
  });

  afterAll(async () => {
    if (createdCompanyIds.length === 0) return;
    const { db } = await import("./client.js");
    const { companies } = await import("./schema.js");
    // crews/crew_members/technicians cascade from companies.
    await db.delete(companies).where(inArray(companies.id, createdCompanyIds));
  });

  it.each(["crews", "crew_members"])("%s forces RLS with a tenant_isolation policy", async (table) => {
    const { db } = await import("./client.js");
    const rows = (await db.execute(sql`
      select c.relrowsecurity, c.relforcerowsecurity,
        exists (select 1 from pg_policies p where p.tablename = ${table}
                and p.policyname = ${`tenant_isolation_${table}`}) as has_policy
      from pg_class c where c.relname = ${table} and c.relkind = 'r'`)) as unknown as Array<Record<string, boolean>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, has_policy: true });
  });

  it("denies cross-tenant reads and enforces the partial unique name index", async () => {
    const { db } = await import("./client.js");
    const { companies, crewMembers, crews, technicians } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");

    const ids: [string, string] = [randomUUID(), randomUUID()];
    createdCompanyIds.push(...ids);
    await db.insert(companies).values(ids.map((id) => ({ id, name: `FS195 RLS ${id.slice(0, 8)}`, slug: `fs195-rls-${id}` })));

    const crewIds: Record<string, string> = {};
    for (const companyId of ids) {
      crewIds[companyId] = randomUUID();
      const technicianId = randomUUID();
      await runTransactionWithTenantSession(companyId, async (tx) => {
        await tx.insert(technicians).values({ id: technicianId, companyId, firstName: "T", lastName: companyId.slice(0, 4), phone: "5550100" });
        await tx.insert(crews).values({ id: crewIds[companyId], companyId, name: "Crew A" });
        await tx.insert(crewMembers).values({ companyId, crewId: crewIds[companyId]!, technicianId, role: "lead" });
      });
    }

    const [companyA, companyB] = ids;
    const visible = await runTransactionWithTenantSession(companyA, async (tx) => {
      if (useProbeRole) await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_PROBE_ROLE}`));
      const crewRows = await tx.select({ id: crews.id }).from(crews);
      const memberRows = await tx.select({ crewId: crewMembers.crewId }).from(crewMembers);
      return { crews: crewRows.map((r) => r.id), members: memberRows.map((r) => r.crewId) };
    });
    expect(visible.crews).toContain(crewIds[companyA]);
    expect(visible.crews).not.toContain(crewIds[companyB]);
    expect(visible.members).not.toContain(crewIds[companyB]);

    await expect(
      runTransactionWithTenantSession(companyA, (tx) => tx.insert(crews).values({ companyId: companyA, name: "Crew A" }))
    ).rejects.toThrow();
    await runTransactionWithTenantSession(companyA, async (tx) => {
      await tx.update(crews).set({ deletedAt: new Date() }).where(sql`${crews.id} = ${crewIds[companyA]}`);
      await tx.insert(crews).values({ companyId: companyA, name: "Crew A" });
    });
  });
});
