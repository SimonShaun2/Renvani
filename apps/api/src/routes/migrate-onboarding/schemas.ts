import type { FastifySchema } from "fastify";
import { z } from "zod";

import {
  applyMigrateDedupeDecisionsBodySchema,
  confirmImportFileLinkDecisionsBodySchema,
  createMigrateOnboardingSessionBodySchema,
  linkMigrateOnboardingFilesBodySchema,
  migrateOnboardingBundleIdParamsSchema,
  setMigrateOnboardingSourceBodySchema
} from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

export type MigrateOnboardingBundleIdParams = z.infer<typeof migrateOnboardingBundleIdParamsSchema>;

export const migrateOnboardingBundleIdValidation = withZodValidation({
  params: migrateOnboardingBundleIdParamsSchema
});

export const createMigrateOnboardingSessionValidation = withZodValidation({
  body: createMigrateOnboardingSessionBodySchema
});

export const setMigrateOnboardingSourceValidation = withZodValidation({
  params: migrateOnboardingBundleIdParamsSchema,
  body: setMigrateOnboardingSourceBodySchema
});

export type SetMigrateOnboardingSourceBody = z.infer<typeof setMigrateOnboardingSourceBodySchema>;

export const linkMigrateOnboardingFilesValidation = withZodValidation({
  params: migrateOnboardingBundleIdParamsSchema,
  body: linkMigrateOnboardingFilesBodySchema
});

export type LinkMigrateOnboardingFilesBody = z.infer<typeof linkMigrateOnboardingFilesBodySchema>;

export const applyMigrateDedupeDecisionsValidation = withZodValidation({
  params: migrateOnboardingBundleIdParamsSchema,
  body: applyMigrateDedupeDecisionsBodySchema
});

export type ApplyMigrateDedupeDecisionsBody = z.infer<typeof applyMigrateDedupeDecisionsBodySchema>;

export const listSourcesRouteSchema: FastifySchema = {};
export const createSessionRouteSchema: FastifySchema = {};
export const getActiveSessionRouteSchema: FastifySchema = {};
export const getBundleRouteSchema: FastifySchema = {};
export const setSourceRouteSchema: FastifySchema = {};
export const linkFilesRouteSchema: FastifySchema = {};
export const confirmMappingsRouteSchema: FastifySchema = {};
export const acknowledgePreviewRouteSchema: FastifySchema = {};
export const dedupePreviewRouteSchema: FastifySchema = {};
export const relationalPreviewRouteSchema: FastifySchema = {};
export const dedupeDecisionsRouteSchema: FastifySchema = {};
export const commitBundleRouteSchema: FastifySchema = {};
export const ingestStatusRouteSchema: FastifySchema = {};

export const confirmImportFileLinkDecisionsValidation = withZodValidation({
  params: migrateOnboardingBundleIdParamsSchema,
  body: confirmImportFileLinkDecisionsBodySchema
});

export const fileLinkPreviewRouteSchema: FastifySchema = {};
export const runFileLinkRouteSchema: FastifySchema = {};
export const confirmFileLinkRouteSchema: FastifySchema = {};
