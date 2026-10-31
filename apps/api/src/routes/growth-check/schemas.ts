import { z } from "zod";

import { growthCheckFindingReviewBodySchema, growthCheckScanListQuerySchema } from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();

export const enqueueGrowthCheckScanBodySchema = z.object({
  targetUrl: z.string().url().max(2048),
  rubricId: z.string().min(1).max(64).optional(),
  idempotencyKey: z.string().min(8).max(128).optional()
});

export type EnqueueGrowthCheckScanBody = z.infer<typeof enqueueGrowthCheckScanBodySchema>;

export const enqueueGrowthCheckScanValidation = withZodValidation({
  body: enqueueGrowthCheckScanBodySchema
});

export const growthCheckScanIdParamsSchema = z.object({
  scanId: uuidSchema
});

export const getGrowthCheckScanValidation = withZodValidation({
  params: growthCheckScanIdParamsSchema
});

// FS-56 findings review (owner/admin). Body schemas live in @fsm/types so the web client shares them.
export const growthCheckFindingIdParamsSchema = z.object({ findingId: uuidSchema }).strict();

export const listGrowthCheckScansValidation = withZodValidation({
  query: growthCheckScanListQuerySchema
});

export const listGrowthCheckScanFindingsValidation = withZodValidation({
  params: growthCheckScanIdParamsSchema
});

export const getGrowthCheckFindingValidation = withZodValidation({
  params: growthCheckFindingIdParamsSchema
});

export const reviewGrowthCheckFindingValidation = withZodValidation({
  params: growthCheckFindingIdParamsSchema,
  body: growthCheckFindingReviewBodySchema
});
