import { z } from "zod";

import { UuidSchema } from "../../agent-control-plane/v1/zod-shared.js";

import { AdapterOperationKindV1Schema, AdapterOperationStatusV1Schema } from "./adapter-operation.js";

export const IntegrationOutboxAuditEventTypeSchema = z.enum([
  "created",
  "processing",
  "retry_receipt",
  "succeeded",
  "dead",
  "duplicate_suppressed"
]);

export type IntegrationOutboxAuditEventType = z.infer<typeof IntegrationOutboxAuditEventTypeSchema>;

/** Max delivery attempts; the receipt for this attempt moves the operation to `dead`. */
export const INTEGRATION_OUTBOX_MAX_ATTEMPTS = 8;
export const INTEGRATION_OUTBOX_BASE_BACKOFF_MS = 30_000;
export const INTEGRATION_OUTBOX_MAX_BACKOFF_MS = 60 * 60 * 1000;

/** Exponential backoff before the next attempt (capped). */
export function integrationOutboxBackoffMs(attemptNumber: number): number {
  return Math.min(
    INTEGRATION_OUTBOX_BASE_BACKOFF_MS * 2 ** Math.max(attemptNumber - 1, 0),
    INTEGRATION_OUTBOX_MAX_BACKOFF_MS
  );
}

export const IntegrationOutboxRetryReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    correlationId: UuidSchema,
    attemptNumber: z.number().int().min(1).max(INTEGRATION_OUTBOX_MAX_ATTEMPTS),
    idempotencyKey: z.string().min(1).max(255),
    source: z.enum(["worker", "operator", "system"]).default("worker")
  })
  .strict();

export type IntegrationOutboxRetryReceipt = z.infer<typeof IntegrationOutboxRetryReceiptSchema>;

export const IntegrationOutboxOperationViewSchema = z
  .object({
    id: UuidSchema,
    companyId: UuidSchema,
    kind: AdapterOperationKindV1Schema,
    adapterId: z.string(),
    idempotencyKey: z.string(),
    correlationId: UuidSchema,
    status: AdapterOperationStatusV1Schema,
    attemptCount: z.number().int().min(0),
    lastError: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
  .strict();

export type IntegrationOutboxOperationView = z.infer<typeof IntegrationOutboxOperationViewSchema>;

export const IntegrationOutboxAuditEventViewSchema = z
  .object({
    id: UuidSchema,
    companyId: UuidSchema,
    outboxOperationId: UuidSchema,
    eventType: IntegrationOutboxAuditEventTypeSchema,
    retryReceiptKey: z.string().nullable().optional(),
    receipt: z.record(z.string(), z.unknown()),
    createdAt: z.string().datetime()
  })
  .strict();

export type IntegrationOutboxAuditEventView = z.infer<typeof IntegrationOutboxAuditEventViewSchema>;

/** Scoped to the outbox operation so a body correlationId cannot collide across operations. */
export function buildIntegrationOutboxRetryReceiptKey(
  outboxOperationId: string,
  correlationId: string,
  attemptNumber: number
): string {
  return `${outboxOperationId}:${correlationId}:retry:${attemptNumber}`;
}
