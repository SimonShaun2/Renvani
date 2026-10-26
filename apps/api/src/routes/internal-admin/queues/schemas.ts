import { z } from "zod";

import { PlatformQueueNameV1Schema, UuidSchema } from "@fsm/types";

export const queueNameParamsSchema = z.object({
  queueName: PlatformQueueNameV1Schema
});

export const tenantScopedQueueJobsQuerySchema = z.object({
  companyId: UuidSchema,
  start: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const recoverDeadLetterJobParamsSchema = z.object({
  queueName: PlatformQueueNameV1Schema,
  deadLetterJobId: z.string().min(1).max(128)
});

/** @deprecated use queueNameParamsSchema */
export const listDeadLetterJobsParamsSchema = queueNameParamsSchema;

/** @deprecated use tenantScopedQueueJobsQuerySchema */
export const listDeadLetterJobsQuerySchema = tenantScopedQueueJobsQuerySchema;
