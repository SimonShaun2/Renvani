import type { FastifyReply, FastifyRequest } from "fastify";

import {
  SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT,
  SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
  type GetSavedCardMigrationResponse,
  applySavedCardMigrationMappingsBodySchema,
  confirmStripeImportBodySchema,
  savedCardMigrationBundleParamsSchema,
  sendSavedCardFallbackEmailBodySchema,
  startSavedCardMigrationBodySchema
} from "@fsm/types";

import {
  applySavedCardMigrationMappingsForBundle,
  confirmStripeImportForBundle,
  getSavedCardMigrationForBundle,
  sendSavedCardMigrationFallbackEmail,
  startSavedCardMigrationForBundle
} from "../../services/saved-card-migration.service.js";

export async function startSavedCardMigrationHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = savedCardMigrationBundleParamsSchema.parse(request.params);
  const body = startSavedCardMigrationBodySchema.parse(request.body);
  const migration = await startSavedCardMigrationForBundle(
    request.company.id,
    request.user.id,
    params.bundleId,
    body
  );
  return reply.code(201).send(migration);
}

export async function getSavedCardMigrationHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = savedCardMigrationBundleParamsSchema.parse(request.params);
  const migration = await getSavedCardMigrationForBundle(request.company.id, params.bundleId);
  const response: GetSavedCardMigrationResponse = {
    migration,
    consent: {
      text: SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT,
      version: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION
    }
  };
  return reply.send(response);
}

export async function confirmStripeImportHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = savedCardMigrationBundleParamsSchema.parse(request.params);
  const body = confirmStripeImportBodySchema.parse(request.body);
  const migration = await confirmStripeImportForBundle(
    request.company.id,
    request.user.id,
    params.bundleId,
    body
  );
  return reply.send(migration);
}

export async function applySavedCardMigrationMappingsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = savedCardMigrationBundleParamsSchema.parse(request.params);
  const body = applySavedCardMigrationMappingsBodySchema.parse(request.body);
  const migration = await applySavedCardMigrationMappingsForBundle(
    request.company.id,
    request.user.id,
    params.bundleId,
    body
  );
  return reply.send(migration);
}

export async function sendSavedCardFallbackEmailHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = savedCardMigrationBundleParamsSchema.parse(request.params);
  const body = sendSavedCardFallbackEmailBodySchema.parse(request.body);
  const migration = await sendSavedCardMigrationFallbackEmail(
    request.company.id,
    request.user.id,
    params.bundleId,
    body.renvaniCustomerId
  );
  return reply.send(migration);
}
