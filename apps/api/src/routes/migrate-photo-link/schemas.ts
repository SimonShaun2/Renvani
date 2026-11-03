import { z } from "zod";

import {
  ApplyMigratePhotoLinkDecisionsBodySchema,
  migrateOnboardingBundleIdParamsSchema
} from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

export const migratePhotoBundleParamsValidation = withZodValidation({
  params: migrateOnboardingBundleIdParamsSchema
});

export const applyPhotoLinkDecisionsValidation = withZodValidation({
  params: migrateOnboardingBundleIdParamsSchema,
  body: ApplyMigratePhotoLinkDecisionsBodySchema
});

export const photoBatchUploadQuerySchema = z.object({
  clientBatchId: z.string().min(1).max(128)
});

export const photoBatchUploadQueryValidation = withZodValidation({
  params: migrateOnboardingBundleIdParamsSchema,
  query: photoBatchUploadQuerySchema
});
