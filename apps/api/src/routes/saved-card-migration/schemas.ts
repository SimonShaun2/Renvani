import type { FastifySchema } from "fastify";

import {
  applySavedCardMigrationMappingsBodySchema,
  confirmStripeImportBodySchema,
  savedCardMigrationBundleParamsSchema,
  sendSavedCardFallbackEmailBodySchema,
  startSavedCardMigrationBodySchema
} from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

export const startSavedCardMigrationValidation = withZodValidation({
  params: savedCardMigrationBundleParamsSchema,
  body: startSavedCardMigrationBodySchema
});

export const startSavedCardMigrationRouteSchema: FastifySchema = {};

export const getSavedCardMigrationValidation = withZodValidation({
  params: savedCardMigrationBundleParamsSchema
});

export const getSavedCardMigrationRouteSchema: FastifySchema = {};

export const confirmStripeImportValidation = withZodValidation({
  params: savedCardMigrationBundleParamsSchema,
  body: confirmStripeImportBodySchema
});

export const confirmStripeImportRouteSchema: FastifySchema = {};

export const applyMappingsValidation = withZodValidation({
  params: savedCardMigrationBundleParamsSchema,
  body: applySavedCardMigrationMappingsBodySchema
});

export const applyMappingsRouteSchema: FastifySchema = {};

export const sendFallbackEmailValidation = withZodValidation({
  params: savedCardMigrationBundleParamsSchema,
  body: sendSavedCardFallbackEmailBodySchema
});

export const sendFallbackEmailRouteSchema: FastifySchema = {};
