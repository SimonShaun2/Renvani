import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { INTEGRATION_OUTBOX_MAX_ATTEMPTS } from "@fsm/types";

// FS-15 follow-up: live retry-receipt semantics against Postgres (NEON_CI_DATABASE_URL only).
const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const enabled = typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");

describe.runIf(enabled)("FS-15 outbox retry receipts (Postgres / Neon CI)", () => {
  const companyId = randomUUID();

  beforeAll(async () => {
    process.env.DATABASE_URL = neonCiUrl;
    process.env.BOOKING_HOLD_TOKEN_SECRET = process.env.BOOKING_HOLD_TOKEN_SECRET ?? "booking_hold_test_secret";
    const { db } = await import("./client.js");
    const { companies } = await import("./schema.js");
    await db.insert(companies).values({ id: companyId, name: "FS15 retry", slug: `fs15-retry-${companyId}` });
  });

  afterAll(async () => {
    const { db } = await import("./client.js");
    const { companies } = await import("./schema.js");
    await db.delete(companies).where(inArray(companies.id, [companyId]));
  });

  async function newOperation(kind = "sms_outbound") {
    const svc = await import("./integration-outbox.service.js");
    const correlationId = randomUUID();
    const { operation } = await svc.createOrGetIntegrationOutboxOperation(companyId, {
      kind,
      adapterId: "notifications_v1",
      idempotencyKey: `fs15-retry:${randomUUID()}`,
      correlationId,
      attribution: { schemaVersion: 1 } as never,
      payload: {}
    });
    return { operation, correlationId, svc };
  }

  const receipt = (correlationId: string, attemptNumber: number) => ({
    schemaVersion: 1 as const,
    correlationId,
    attemptNumber,
    idempotencyKey: "k",
    source: "worker" as const
  });

  it("never decreases attemptCount and dedupes replays", async () => {
    const { operation, correlationId, svc } = await newOperation();
    await svc.recordIntegrationOutboxRetryReceipt(companyId, operation.id, receipt(correlationId, 3));
    await svc.recordIntegrationOutboxRetryReceipt(companyId, operation.id, receipt(correlationId, 2));
    const replay = await svc.recordIntegrationOutboxRetryReceipt(companyId, operation.id, receipt(correlationId, 3));
    expect(replay.deduplicated).toBe(true);
    const row = await svc.getIntegrationOutboxOperationById(companyId, operation.id);
    expect(row?.attemptCount).toBe(3);
    expect(row?.status).toBe("processing");
  });

  it("dead-letters at the attempt cap and never reopens a terminal operation", async () => {
    const { operation, correlationId, svc } = await newOperation();
    await svc.recordIntegrationOutboxRetryReceipt(
      companyId,
      operation.id,
      receipt(correlationId, INTEGRATION_OUTBOX_MAX_ATTEMPTS)
    );
    const dead = await svc.getIntegrationOutboxOperationById(companyId, operation.id);
    expect(dead?.status).toBe("dead");
    expect(dead?.lastError).toBe("max_attempts_reached");
    const events = await svc.listIntegrationOutboxAuditEvents(companyId, { outboxOperationId: operation.id });
    expect(events.map((e) => e.eventType)).toEqual(expect.arrayContaining(["dead", "retry_receipt"]));

    await expect(
      svc.recordIntegrationOutboxRetryReceipt(companyId, operation.id, receipt(correlationId, 1))
    ).rejects.toThrow("INTEGRATION_OUTBOX_TERMINAL");
    expect((await svc.getIntegrationOutboxOperationById(companyId, operation.id))?.status).toBe("dead");
  });

  it("does not write an audit row for duplicate creates", async () => {
    const svc = await import("./integration-outbox.service.js");
    const input = {
      kind: "email_outbound",
      adapterId: "notifications_v1",
      idempotencyKey: `fs15-dup:${randomUUID()}`,
      correlationId: randomUUID(),
      attribution: { schemaVersion: 1 } as never,
      payload: {}
    };
    const first = await svc.createOrGetIntegrationOutboxOperation(companyId, input);
    const second = await svc.createOrGetIntegrationOutboxOperation(companyId, input);
    expect(second.created).toBe(false);
    expect(second.operation.id).toBe(first.operation.id);
    const events = await svc.listIntegrationOutboxAuditEvents(companyId, { outboxOperationId: first.operation.id });
    expect(events.map((e) => e.eventType)).toEqual(["created"]);
  });

  it("stores a registered non-builtin kind without a migration (varchar kind)", async () => {
    const { operation } = await newOperation("fax_outbound");
    const { integrationOutboxOperations } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");
    const [row] = await runTransactionWithTenantSession(companyId, (tx) =>
      tx
        .select({ kind: integrationOutboxOperations.kind })
        .from(integrationOutboxOperations)
        .where(and(eq(integrationOutboxOperations.id, operation.id)))
    );
    expect(row?.kind).toBe("fax_outbound");
  });
});
