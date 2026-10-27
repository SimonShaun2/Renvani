import type { FastifyReply, FastifyRequest } from "fastify";

import {
  internalAdminListSavedCardMigrationsQuerySchema,
  savedCardMigrationIdParamsSchema
} from "@fsm/types";

import {
  getSavedCardMigrationByIdForAdmin,
  listSavedCardMigrationsForAdmin
} from "../../../services/saved-card-migration.service.js";

export async function listInternalSavedCardMigrationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = internalAdminListSavedCardMigrationsQuerySchema.parse(request.query);
  const result = await listSavedCardMigrationsForAdmin(query);
  return reply.send(result);
}

export async function getInternalSavedCardMigrationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const params = savedCardMigrationIdParamsSchema.parse(request.params);
  const migration = await getSavedCardMigrationByIdForAdmin(params.migrationId);
  return reply.send(migration);
}
