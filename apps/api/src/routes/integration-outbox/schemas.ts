import type { FastifySchema } from "fastify";
import { z } from "zod";

import {
  AdapterOperationKindV1Schema,
  AttributionV1Schema,
  IntegrationOutboxRetryReceiptSchema
} from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();

/**
 * Size caps for client-supplied JSON (payload/attribution are stored as jsonb on every outbox row
 * and kept for the outbox audit retention window, so they must stay small; no PII bodies here).
 */
export const INTEGRATION_OUTBOX_PAYLOAD_MAX_BYTES = 16 * 1024;
export const INTEGRATION_OUTBOX_PAYLOAD_MAX_KEYS = 50;
export const INTEGRATION_OUTBOX_ATTRIBUTION_MAX_BYTES = 8 * 1024;

function jsonByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

const boundedPayloadSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => Object.keys(value).length <= INTEGRATION_OUTBOX_PAYLOAD_MAX_KEYS, {
    message: `payload may have at most ${INTEGRATION_OUTBOX_PAYLOAD_MAX_KEYS} keys`
  })
  .refine((value) => jsonByteLength(value) <= INTEGRATION_OUTBOX_PAYLOAD_MAX_BYTES, {
    message: `payload must be at most ${INTEGRATION_OUTBOX_PAYLOAD_MAX_BYTES} bytes`
  });

const boundedAttributionSchema = AttributionV1Schema.refine(
  (value) => jsonByteLength(value) <= INTEGRATION_OUTBOX_ATTRIBUTION_MAX_BYTES,
  { message: `attribution must be at most ${INTEGRATION_OUTBOX_ATTRIBUTION_MAX_BYTES} bytes` }
);

export const integrationOutboxOperationIdParamsSchema = z.object({
  operationId: uuidSchema
});

export const listIntegrationOutboxOperationsQuerySchema = z.object({
  correlationId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const listIntegrationOutboxAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const createIntegrationOutboxOperationBodySchema = z
  .object({
    kind: AdapterOperationKindV1Schema,
    adapterId: z.string().min(1).max(64),
    idempotencyKey: z.string().min(1).max(255),
    correlationId: uuidSchema,
    attribution: boundedAttributionSchema,
    payload: boundedPayloadSchema.default({})
  })
  .strict();

export const recordIntegrationOutboxRetryBodySchema = IntegrationOutboxRetryReceiptSchema;

export const listIntegrationOutboxOperationsValidation = withZodValidation({
  query: listIntegrationOutboxOperationsQuerySchema
});

export const listIntegrationOutboxAuditValidation = withZodValidation({
  params: integrationOutboxOperationIdParamsSchema,
  query: listIntegrationOutboxAuditQuerySchema
});

export const createIntegrationOutboxOperationValidation = withZodValidation({
  body: createIntegrationOutboxOperationBodySchema
});

export const recordIntegrationOutboxRetryValidation = withZodValidation({
  params: integrationOutboxOperationIdParamsSchema,
  body: recordIntegrationOutboxRetryBodySchema
});

export const listIntegrationOutboxOperationsRouteSchema: FastifySchema = {};
export const listIntegrationOutboxAuditRouteSchema: FastifySchema = {};
export const createIntegrationOutboxOperationRouteSchema: FastifySchema = {};
export const recordIntegrationOutboxRetryRouteSchema: FastifySchema = {};

export type IntegrationOutboxOperationIdParams = z.infer<typeof integrationOutboxOperationIdParamsSchema>;
export type ListIntegrationOutboxOperationsQuery = z.infer<typeof listIntegrationOutboxOperationsQuerySchema>;
export type ListIntegrationOutboxAuditQuery = z.infer<typeof listIntegrationOutboxAuditQuerySchema>;
export type CreateIntegrationOutboxOperationBody = z.infer<typeof createIntegrationOutboxOperationBodySchema>;
export type RecordIntegrationOutboxRetryBody = z.infer<typeof recordIntegrationOutboxRetryBodySchema>;
