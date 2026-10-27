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

export const IntegrationOutboxRetryReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    correlationId: UuidSchema,
    attemptNumber: z.number().int().min(1),
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

export function buildIntegrationOutboxRetryReceiptKey(
  correlationId: string,
  attemptNumber: number
): string {
  return `${correlationId}:retry:${attemptNumber}`;
}
