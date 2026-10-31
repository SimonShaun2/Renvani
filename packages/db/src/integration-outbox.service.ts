import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNotNull, isNull, not, sql } from "drizzle-orm";

import {
  type AdapterOperationKindV1,
  type AdapterOperationStatusV1,
  type AttributionV1,
  type IntegrationOutboxAuditEventType,
  type IntegrationOutboxRetryReceipt,
  INTEGRATION_OUTBOX_MAX_ATTEMPTS,
  IntegrationOutboxRetryReceiptSchema,
  buildIntegrationOutboxRetryReceiptKey,
  integrationOutboxBackoffMs
} from "@fsm/types";

import { runTransactionWithTenantSession } from "./run-with-tenant-session.js";
import { integrationOutboxAuditEvents, integrationOutboxOperations } from "./schema.js";
import type { TransactionCallback } from "./transactions.js";

type Tx = Parameters<TransactionCallback<unknown>>[0];

export type CreateIntegrationOutboxOperationInput = {
  kind: AdapterOperationKindV1;
  adapterId: string;
  idempotencyKey: string;
  correlationId: string;
  attribution: AttributionV1;
  payload: Record<string, unknown>;
};

type OutboxRow = typeof integrationOutboxOperations.$inferSelect;
type AuditRow = typeof integrationOutboxAuditEvents.$inferSelect;

function mapOperation(row: OutboxRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    kind: row.kind as AdapterOperationKindV1,
    adapterId: row.adapterId,
    idempotencyKey: row.idempotencyKey,
    correlationId: row.correlationId,
    status: row.status as AdapterOperationStatusV1,
    attemptCount: row.attemptCount,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapAudit(row: AuditRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    outboxOperationId: row.outboxOperationId,
    eventType: row.eventType as IntegrationOutboxAuditEventType,
    retryReceiptKey: row.retryReceiptKey,
    receipt: (row.receipt ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt
  };
}

async function appendAuditEvent(
  tx: Tx,
  companyId: string,
  outboxOperationId: string,
  eventType:
    | "created"
    | "processing"
    | "retry_receipt"
    | "succeeded"
    | "dead"
    | "duplicate_suppressed",
  receipt: Record<string, unknown>,
  retryReceiptKey?: string
): Promise<AuditRow> {
  const [inserted] = await tx
    .insert(integrationOutboxAuditEvents)
    .values({
      companyId,
      outboxOperationId,
      eventType,
      receipt,
      retryReceiptKey: retryReceiptKey ?? null
    })
    .onConflictDoNothing({
      target: [integrationOutboxAuditEvents.companyId, integrationOutboxAuditEvents.retryReceiptKey],
      where: isNotNull(integrationOutboxAuditEvents.retryReceiptKey)
    })
    .returning();

  if (inserted) {
    return inserted;
  }

  if (retryReceiptKey) {
    const existing = await tx.query.integrationOutboxAuditEvents.findFirst({
      where: and(
        eq(integrationOutboxAuditEvents.companyId, companyId),
        eq(integrationOutboxAuditEvents.retryReceiptKey, retryReceiptKey)
      )
    });
    if (existing) {
      return existing;
    }
  }

  throw new Error("INTEGRATION_OUTBOX_AUDIT_INSERT_FAILED");
}

export async function createOrGetIntegrationOutboxOperation(
  companyId: string,
  input: CreateIntegrationOutboxOperationInput
): Promise<{ operation: ReturnType<typeof mapOperation>; created: boolean }> {
  return runTransactionWithTenantSession(companyId, async (tx) => {
    const existing = await tx.query.integrationOutboxOperations.findFirst({
      where: and(
        eq(integrationOutboxOperations.companyId, companyId),
        eq(integrationOutboxOperations.kind, input.kind),
        eq(integrationOutboxOperations.idempotencyKey, input.idempotencyKey),
        isNull(integrationOutboxOperations.deletedAt)
      )
    });

    // Duplicates are reported via created=false (caller logs); no audit row per duplicate.
    if (existing) {
      return { operation: mapOperation(existing), created: false };
    }

    const operationId = randomUUID();
    const [inserted] = await tx
      .insert(integrationOutboxOperations)
      .values({
        id: operationId,
        companyId,
        kind: input.kind,
        adapterId: input.adapterId,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        attribution: input.attribution,
        payload: input.payload,
        status: "pending",
        attemptCount: 0
      })
      .onConflictDoNothing({
        target: [
          integrationOutboxOperations.companyId,
          integrationOutboxOperations.kind,
          integrationOutboxOperations.idempotencyKey
        ],
        where: isNull(integrationOutboxOperations.deletedAt)
      })
      .returning();

    if (!inserted) {
      // Lost a concurrent insert race: return the winner (no audit row for duplicates).
      const winner = await tx.query.integrationOutboxOperations.findFirst({
        where: and(
          eq(integrationOutboxOperations.companyId, companyId),
          eq(integrationOutboxOperations.kind, input.kind),
          eq(integrationOutboxOperations.idempotencyKey, input.idempotencyKey),
          isNull(integrationOutboxOperations.deletedAt)
        )
      });
      if (!winner) {
        throw new Error("INTEGRATION_OUTBOX_INSERT_FAILED");
      }
      return { operation: mapOperation(winner), created: false };
    }

    await appendAuditEvent(tx, companyId, inserted.id, "created", {
      schemaVersion: 1,
      kind: input.kind,
      adapterId: input.adapterId,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId
    });

    return { operation: mapOperation(inserted), created: true };
  });
}

export async function recordIntegrationOutboxRetryReceipt(
  companyId: string,
  outboxOperationId: string,
  receiptInput: IntegrationOutboxRetryReceipt
): Promise<{ auditEvent: ReturnType<typeof mapAudit>; deduplicated: boolean }> {
  return runTransactionWithTenantSession(companyId, async (tx) => {
    const receipt = IntegrationOutboxRetryReceiptSchema.parse(receiptInput);
    const retryReceiptKey = buildIntegrationOutboxRetryReceiptKey(
      outboxOperationId,
      receipt.correlationId,
      receipt.attemptNumber
    );

    const operation = await tx.query.integrationOutboxOperations.findFirst({
      where: and(
        eq(integrationOutboxOperations.id, outboxOperationId),
        eq(integrationOutboxOperations.companyId, companyId),
        isNull(integrationOutboxOperations.deletedAt)
      )
    });

    if (!operation) {
      throw new Error("INTEGRATION_OUTBOX_NOT_FOUND");
    }

    if (operation.correlationId !== receipt.correlationId) {
      throw new Error("INTEGRATION_OUTBOX_CORRELATION_MISMATCH");
    }

    const existingReceipt = await tx.query.integrationOutboxAuditEvents.findFirst({
      where: and(
        eq(integrationOutboxAuditEvents.companyId, companyId),
        eq(integrationOutboxAuditEvents.retryReceiptKey, retryReceiptKey)
      )
    });

    if (existingReceipt) {
      return { auditEvent: mapAudit(existingReceipt), deduplicated: true };
    }

    // Terminal ops never reopen; attemptCount only moves forward; the capped attempt dead-letters.
    const reachedCap = receipt.attemptNumber >= INTEGRATION_OUTBOX_MAX_ATTEMPTS;
    const [updated] = await tx
      .update(integrationOutboxOperations)
      .set({
        status: reachedCap ? "dead" : "processing",
        attemptCount: sql`GREATEST(${integrationOutboxOperations.attemptCount}, ${receipt.attemptNumber})`,
        ...(reachedCap ? { lastError: "max_attempts_reached" } : {}),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(integrationOutboxOperations.id, outboxOperationId),
          eq(integrationOutboxOperations.companyId, companyId),
          not(inArray(integrationOutboxOperations.status, ["succeeded", "dead"]))
        )
      )
      .returning();

    if (!updated) {
      throw new Error("INTEGRATION_OUTBOX_TERMINAL");
    }

    if (reachedCap) {
      await appendAuditEvent(tx, companyId, outboxOperationId, "dead", {
        schemaVersion: 1,
        reason: "max_attempts_reached",
        attemptNumber: receipt.attemptNumber,
        maxAttempts: INTEGRATION_OUTBOX_MAX_ATTEMPTS
      });
    }

    try {
      const auditRow = await appendAuditEvent(
        tx,
        companyId,
        outboxOperationId,
        "retry_receipt",
        {
          ...receipt,
          ...(reachedCap ? {} : { nextRetryAfterMs: integrationOutboxBackoffMs(receipt.attemptNumber) })
        },
        retryReceiptKey
      );
      return { auditEvent: mapAudit(auditRow), deduplicated: false };
    } catch (error) {
      const duplicate = await tx.query.integrationOutboxAuditEvents.findFirst({
        where: and(
          eq(integrationOutboxAuditEvents.companyId, companyId),
          eq(integrationOutboxAuditEvents.retryReceiptKey, retryReceiptKey)
        )
      });
      if (duplicate) {
        return { auditEvent: mapAudit(duplicate), deduplicated: true };
      }
      throw error;
    }
  });
}

export async function listIntegrationOutboxAuditEvents(
  companyId: string,
  input: { outboxOperationId: string; limit?: number }
): Promise<ReturnType<typeof mapAudit>[]> {
  return runTransactionWithTenantSession(companyId, async (tx) => {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);

    const rows = await tx
      .select()
      .from(integrationOutboxAuditEvents)
      .where(
        and(
          eq(integrationOutboxAuditEvents.companyId, companyId),
          eq(integrationOutboxAuditEvents.outboxOperationId, input.outboxOperationId)
        )
      )
      .orderBy(desc(integrationOutboxAuditEvents.createdAt))
      .limit(limit);

    return rows.map(mapAudit);
  });
}

export async function getIntegrationOutboxOperationById(
  companyId: string,
  outboxOperationId: string
): Promise<ReturnType<typeof mapOperation> | null> {
  return runTransactionWithTenantSession(companyId, async (tx) => {
    const row = await tx.query.integrationOutboxOperations.findFirst({
      where: and(
        eq(integrationOutboxOperations.id, outboxOperationId),
        eq(integrationOutboxOperations.companyId, companyId),
        isNull(integrationOutboxOperations.deletedAt)
      )
    });

    return row ? mapOperation(row) : null;
  });
}

export async function listIntegrationOutboxOperations(
  companyId: string,
  input: { correlationId?: string; limit?: number }
): Promise<ReturnType<typeof mapOperation>[]> {
  return runTransactionWithTenantSession(companyId, async (tx) => {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);

    const conditions = [
      eq(integrationOutboxOperations.companyId, companyId),
      isNull(integrationOutboxOperations.deletedAt)
    ];

    if (input.correlationId) {
      conditions.push(eq(integrationOutboxOperations.correlationId, input.correlationId));
    }

    const rows = await tx
      .select()
      .from(integrationOutboxOperations)
      .where(and(...conditions))
      .orderBy(desc(integrationOutboxOperations.createdAt))
      .limit(limit);

    return rows.map(mapOperation);
  });
}
