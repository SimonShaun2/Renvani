import { randomUUID } from "node:crypto";

import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// FS-199: live tenant isolation + idempotent webhook upsert for stripe_disputes (NEON_CI_DATABASE_URL only).
const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const enabled = typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");
const TABLE = "stripe_disputes";

describe.runIf(enabled)("FS-199 stripe_disputes RLS (Postgres / Neon CI)", () => {
  const RLS_PROBE_ROLE = "fs199_rls_disputes_probe";
  const createdCompanyIds: string[] = [];
  let useProbeRole = false;

  beforeAll(async () => {
    process.env.DATABASE_URL = neonCiUrl;
    process.env.BOOKING_HOLD_TOKEN_SECRET = process.env.BOOKING_HOLD_TOKEN_SECRET ?? "booking_hold_test_secret";
    const { db } = await import("./client.js");
    const [self] = (await db.execute(sql`select rolbypassrls from pg_roles where rolname = current_user`)) as unknown as {
      rolbypassrls: boolean;
    }[];
    useProbeRole = self?.rolbypassrls === true;
    if (!useProbeRole) return;
    await db.execute(
      sql.raw(`DO $$ BEGIN
        CREATE ROLE ${RLS_PROBE_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS;
      EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL; END $$`)
    );
    await db.execute(sql.raw(`GRANT ${RLS_PROBE_ROLE} TO CURRENT_USER`));
    await db.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO ${RLS_PROBE_ROLE}`));
    await db.execute(sql.raw(`GRANT SELECT ON ${TABLE} TO ${RLS_PROBE_ROLE}`));
  });

  afterAll(async () => {
    if (createdCompanyIds.length === 0) return;
    const { db } = await import("./client.js");
    const { companies } = await import("./schema.js");
    await db.delete(companies).where(inArray(companies.id, createdCompanyIds));
  });

  const snapshot = (disputeId: string, status: string, version: string) => ({
    stripeDisputeId: disputeId,
    stripeChargeId: "ch_test",
    stripePaymentIntentId: null,
    amountMinor: 1999,
    currency: "usd",
    status,
    reason: "fraudulent",
    evidenceDueBy: null,
    disputedAt: new Date("2026-10-01T00:00:00.000Z"),
    resourceVersion: version
  });

  it("forces RLS with the tenant_isolation policy", async () => {
    const { db } = await import("./client.js");
    const rows = (await db.execute(sql`
      select c.relrowsecurity, c.relforcerowsecurity,
        exists (select 1 from pg_policies p where p.tablename = ${TABLE}
                and p.policyname = ${`tenant_isolation_${TABLE}`}) as has_policy
      from pg_class c where c.relname = ${TABLE} and c.relkind = 'r'`)) as unknown as Array<Record<string, boolean>>;
    expect(rows[0]).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, has_policy: true });
  });

  it("denies cross-tenant dispute reads", async () => {
    const { db } = await import("./client.js");
    const { companies, stripeDisputes } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");
    const { upsertStripeDisputeFromWebhook, getStripeDisputeById } = await import("./stripe-dispute.service.js");

    const ids: [string, string] = [randomUUID(), randomUUID()];
    createdCompanyIds.push(...ids);
    await db.insert(companies).values(ids.map((id) => ({ id, name: `FS199 ${id.slice(0, 8)}`, slug: `fs199-${id}` })));
    const rowIds: Record<string, string> = {};
    for (const companyId of ids) {
      const res = await upsertStripeDisputeFromWebhook(companyId, snapshot(`dp_${companyId.slice(0, 8)}`, "needs_response", "001:evt"));
      rowIds[companyId] = res.disputeId!;
    }
    const [a, b] = ids;
    const visible = await runTransactionWithTenantSession(a, async (tx) => {
      if (useProbeRole) await tx.execute(sql.raw(`SET LOCAL ROLE ${RLS_PROBE_ROLE}`));
      return (await tx.select({ id: stripeDisputes.id }).from(stripeDisputes)).map((r) => r.id);
    });
    expect(visible).toContain(rowIds[a]);
    expect(visible).not.toContain(rowIds[b]);
    expect(await getStripeDisputeById(a, rowIds[b]!)).toBeNull();
  });

  it("applies newer webhook versions only (replay / out-of-order safe)", async () => {
    const { db } = await import("./client.js");
    const { companies } = await import("./schema.js");
    const { upsertStripeDisputeFromWebhook, listStripeDisputes } = await import("./stripe-dispute.service.js");
    const companyId = randomUUID();
    createdCompanyIds.push(companyId);
    await db.insert(companies).values({ id: companyId, name: "FS199 order", slug: `fs199-order-${companyId}` });

    expect((await upsertStripeDisputeFromWebhook(companyId, snapshot("dp_order", "needs_response", "002:evt_b"))).applied).toBe(true);
    expect((await upsertStripeDisputeFromWebhook(companyId, snapshot("dp_order", "under_review", "001:evt_a"))).applied).toBe(false);
    expect((await upsertStripeDisputeFromWebhook(companyId, snapshot("dp_order", "needs_response", "002:evt_b"))).applied).toBe(false);
    expect((await upsertStripeDisputeFromWebhook(companyId, snapshot("dp_order", "won", "003:evt_c"))).applied).toBe(true);

    const page = await listStripeDisputes(companyId, {});
    expect(page.data).toHaveLength(1);
    expect(page.data[0]).toMatchObject({ status: "won", open: false, amount: "19.99" });
    const filtered = await listStripeDisputes(companyId, { status: "needs_response" });
    expect(filtered.data).toHaveLength(0);
  });
});
