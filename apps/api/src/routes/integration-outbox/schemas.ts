import type { FastifySchema } from "fastify";
import { z } from "zod";

import {
  AdapterOperationKindV1Schema,
  AttributionV1Schema,
  IntegrationOutboxRetryReceiptSchema
} from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();

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
    attribution: AttributionV1Schema,
    payload: z.record(z.string(), z.unknown()).default({})
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
