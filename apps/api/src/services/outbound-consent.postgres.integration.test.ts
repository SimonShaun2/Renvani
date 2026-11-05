import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { resetEnvCacheForTests } from "@fsm/config";
import { setupTestEnv } from "../test-support/env-setup.js";

// The CI runner supplies an isolated, disposable database after applying 0061 and 0062.
// An ordinary local test run must visibly skip rather than touch shared staging.
const isolatedUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const provisionUrl = process.env.FS234_PROVISION_DATABASE_URL?.trim();
const enabled = Boolean(isolatedUrl?.startsWith("postgres") && provisionUrl?.startsWith("postgres")) &&
  process.env.FS234_ISOLATED_DATABASE === "1";
setupTestEnv();
if (enabled) {
  vi.stubEnv("DATABASE_URL", isolatedUrl!);
  vi.stubEnv("DATABASE_POOL_MAX", "8");
  resetEnvCacheForTests();
}

type Db = typeof import("@fsm/db");
type Service = typeof import("./outbound-consent.service.js");
type Fixture = { companyId: string; ownerId: string; customerId: string; email: string };
const provisionSql = enabled ? postgres(provisionUrl!, { max: 2, onnotice: () => undefined }) : null;
const provisionDb = provisionSql ? drizzle(provisionSql) : null;

describe.runIf(enabled)("FS-234 operator consent revocation (isolated PostgreSQL)", { timeout: 30_000 }, () => {
  let dbModule: Db;
  let service: Service;

  beforeAll(async () => {
    dbModule = await import("@fsm/db");
    service = await import("./outbound-consent.service.js");
    const [role] = await dbModule.db.execute(sql`select rolbypassrls, rolsuper from pg_roles where rolname = current_user`) as
      unknown as Array<{ rolbypassrls: boolean; rolsuper: boolean }>;
    expect(role).toMatchObject({ rolbypassrls: false, rolsuper: false });
  });

  afterAll(async () => { await provisionSql?.end({ timeout: 5 }); });

  async function fixture(): Promise<Fixture> {
    const companyId = randomUUID();
    const ownerId = randomUUID();
    const customerId = randomUUID();
    const email = `customer-${customerId}@example.test`;
    await provisionDb!.insert(dbModule.companies).values({
      id: companyId, name: "FS234 isolated test", slug: `fs234-${companyId}`,
    });
    await provisionDb!.insert(dbModule.users).values({
      id: ownerId, companyId, email: `owner-${ownerId}@example.test`,
      firstName: "Isolated", lastName: "Owner", role: "owner",
    });
    await provisionDb!.insert(dbModule.customers).values({
      id: customerId, companyId, firstName: "Synthetic", lastName: "Customer", email,
    });
    return { companyId, ownerId, customerId, email };
  }

  function request(f: Fixture, idempotencyKey = randomUUID()) {
    return { customerId: f.customerId, channel: "email", purpose: "marketing", idempotencyKey };
  }

  function actor(f: Fixture) {
    return { companyId: f.companyId, actorType: "user" as const, actorId: f.ownerId, role: "owner" as const };
  }

  async function evidence(f: Fixture) {
    return dbModule.runTransactionWithTenantSession(f.companyId, async (tx) => {
      const where = eq(dbModule.outboundConsentEvents.companyId, f.companyId);
      return {
        receipts: await tx.select().from(dbModule.outboundConsentCaptureReceipts)
          .where(eq(dbModule.outboundConsentCaptureReceipts.companyId, f.companyId)),
        events: await tx.select().from(dbModule.outboundConsentEvents).where(where),
        states: await tx.select().from(dbModule.outboundConsentStates)
          .where(eq(dbModule.outboundConsentStates.companyId, f.companyId)),
        activity: await tx.select().from(dbModule.activityEvents).where(and(
          eq(dbModule.activityEvents.companyId, f.companyId),
          eq(dbModule.activityEvents.eventType, "outbound_consent.revoked"),
        )),
      };
    });
  }

  it("rejects technician and system actors before writing evidence", async () => {
    const f = await fixture();
    await expect(service.revokeOperatorOutboundConsent({ ...actor(f), role: "technician" as "owner" }, request(f)))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.revokeOperatorOutboundConsent({ ...actor(f), actorType: "system", actorId: null }, request(f)))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await evidence(f)).toMatchObject({ receipts: [], events: [], states: [], activity: [] });
  });

  it("persists one receipt, ledger event, current state and activity atomically", async () => {
    const f = await fixture();
    const result = await service.revokeOperatorOutboundConsent(actor(f), request(f));
    const rows = await evidence(f);
    expect(rows.receipts).toHaveLength(1);
    expect(rows.events).toHaveLength(1);
    expect(rows.states).toHaveLength(1);
    expect(rows.activity).toHaveLength(1);
    expect(rows.receipts[0]).toMatchObject({ companyId: f.companyId, contact: f.email,
      decision: "revoke", sourceSurface: "operator", actorId: f.ownerId });
    expect(rows.events[0]).toMatchObject({ id: result.id, currentState: "revoked", version: 1 });
    expect(rows.states[0]).toMatchObject({ state: "revoked", version: 1, lastEventId: result.id });
    expect(rows.activity[0]?.entityId).toBe(result.id);
  });

  it("serializes concurrent duplicate requests into one idempotent decision", async () => {
    const f = await fixture();
    const input = request(f);
    const results = await Promise.all(Array.from({ length: 4 }, () =>
      service.revokeOperatorOutboundConsent(actor(f), input)));
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    const rows = await evidence(f);
    expect([rows.receipts.length, rows.events.length, rows.states.length, rows.activity.length]).toEqual([1, 1, 1, 1]);
    await expect(service.revokeOperatorOutboundConsent(actor(f), { ...input, purpose: "appointment" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("cannot revoke another tenant's customer through a trusted tenant session", async () => {
    const owner = await fixture();
    const foreign = await fixture();
    await expect(service.revokeOperatorOutboundConsent(actor(owner), {
      ...request(owner), customerId: foreign.customerId,
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await evidence(owner)).toMatchObject({ receipts: [], events: [], states: [], activity: [] });
    expect(await evidence(foreign)).toMatchObject({ receipts: [], events: [], states: [], activity: [] });
  });

  it("fails closed when the customer's destination changes after a decision", async () => {
    const f = await fixture();
    await service.revokeOperatorOutboundConsent(actor(f), request(f));
    await provisionDb!.update(dbModule.customers).set({ email: `changed-${f.customerId}@example.test` })
      .where(and(eq(dbModule.customers.companyId, f.companyId), eq(dbModule.customers.id, f.customerId)));
    const check = await service.checkOutboundConsent(f.companyId, {
      companyId: f.companyId, subjectType: "customer", subjectId: f.customerId,
      channel: "email", purpose: "marketing", contact: f.email,
    });
    expect(check).toMatchObject({ eligible: false, reason: "subject_unavailable" });
    await expect(service.revokeOperatorOutboundConsent(actor(f), { ...request(f), idempotencyKey: "old-contact-replay" }))
      .resolves.toMatchObject({ currentState: "revoked" });
    const rows = await evidence(f);
    expect(rows.states).toHaveLength(2);
    expect(rows.states.map((row) => row.contact)).toContain(f.email);
  });

  it("rolls back receipt, ledger and state when audit activity insertion fails", async () => {
    const f = await fixture();
    await provisionDb!.execute(sql.raw(`CREATE FUNCTION fs234_reject_activity() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.event_type = 'outbound_consent.revoked' THEN RAISE EXCEPTION 'FS234 isolated audit failure'; END IF;
      RETURN NEW; END $$`));
    await provisionDb!.execute(sql.raw(`CREATE TRIGGER fs234_reject_activity_trg BEFORE INSERT ON activity_events
      FOR EACH ROW EXECUTE FUNCTION fs234_reject_activity()`));
    try {
      await expect(service.revokeOperatorOutboundConsent(actor(f), request(f)))
        .rejects.toMatchObject({
          cause: { code: "P0001", message: "FS234 isolated audit failure" },
        });
      expect(await evidence(f)).toMatchObject({ receipts: [], events: [], states: [], activity: [] });
    } finally {
      await provisionDb!.execute(sql.raw("DROP TRIGGER IF EXISTS fs234_reject_activity_trg ON activity_events"));
      await provisionDb!.execute(sql.raw("DROP FUNCTION IF EXISTS fs234_reject_activity()"));
    }
  });
});
