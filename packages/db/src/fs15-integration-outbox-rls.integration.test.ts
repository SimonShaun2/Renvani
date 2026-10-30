import { randomUUID } from "node:crypto";

import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// FS-15 (0050): live cross-tenant check for the integration outbox tables
// (runs only when NEON_CI_DATABASE_URL points at Postgres).
const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const postgresIntegrationEnabled = typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");
const TABLES = ["integration_outbox_operations", "integration_outbox_audit_events"] as const;

describe.runIf(postgresIntegrationEnabled)("FS-15 integration outbox RLS (Postgres / Neon CI)", () => {
  const RLS_PROBE_ROLE = "fs15_rls_outbox_probe";
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
    await db.execute(sql.raw(`GRANT SELECT ON ${TABLES.join(", ")} TO ${RLS_PROBE_ROLE}`));
  });

  afterAll(async () => {
    if (createdCompanyIds.length === 0) return;
    const { db } = await import("./client.js");
    const { companies } = await import("./schema.js");
    // Outbox rows cascade from companies.
    await db.delete(companies).where(inArray(companies.id, createdCompanyIds));
  });

  it("forces RLS with tenant_isolation policies on both tables", async () => {
    const { db } = await import("./client.js");
    for (const table of TABLES) {
      const rows = (await db.execute(sql`
        select c.relrowsecurity, c.relforcerowsecurity,
          exists (select 1 from pg_policies p where p.tablename = ${table}
                  and p.policyname = ${`tenant_isolation_${table}`}) as has_policy
        from pg_class c where c.relname = ${table} and c.relkind = 'r'`)) as unknown as Array<{
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
        has_policy: boolean;
      }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, has_policy: true });
    }
  });

  it("denies cross-tenant reads on outbox operations and audit events", async () => {
    const { db } = await import("./client.js");
    const { companies, integrationOutboxAuditEvents, integrationOutboxOperations } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");
    const { createOrGetIntegrationOutboxOperation } = await import("./integration-outbox.service.js");

    const ids: [string, string] = [randomUUID(), randomUUID()];
    createdCompanyIds.push(...ids);
    await db.insert(companies).values(
      ids.map((id) => ({ id, name: `FS15 RLS ${id.slice(0, 8)}`, slug: `fs15-rls-${id}` }))
    );

    const opIds: Record<string, string> = {};
    for (const companyId of ids) {
      const { operation } = await createOrGetIntegrationOutboxOperation(companyId, {
        kind: "sms_outbound",
        adapterId: "notifications_v1",
        idempotencyKey: `fs15-rls:${companyId}`,
        correlationId: randomUUID(),
        attribution: { schemaVersion: 1 } as never,
        payload: {}
      });
      opIds[companyId] = operation.id;
    }

    const [companyA, companyB] = ids;
    const visible = await runTransactionWithTenantSession(companyA, async (tx) => {
      if (useProbeRole) await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_PROBE_ROLE}`));
      const ops = await tx.select({ id: integrationOutboxOperations.id }).from(integrationOutboxOperations);
      const audits = await tx
        .select({ op: integrationOutboxAuditEvents.outboxOperationId })
        .from(integrationOutboxAuditEvents);
      return { ops: ops.map((r) => r.id), audits: audits.map((r) => r.op) };
    });

    expect(visible.ops).toContain(opIds[companyA]);
    expect(visible.ops).not.toContain(opIds[companyB]);
    expect(visible.audits).toContain(opIds[companyA]);
    expect(visible.audits).not.toContain(opIds[companyB]);
  });
});
