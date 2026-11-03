import type { FastifyPluginAsync } from "fastify";

import { requireRenaviInternalAdmin } from "../../../lib/require-renavi-internal-admin.js";
import {
  getInternalSavedCardMigrationHandler,
  listInternalSavedCardMigrationsHandler
} from "./handlers.js";

const internalAdminSavedCardMigrationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/internal/admin/saved-card-migrations", {
    preHandler: [fastify.authenticate, ...requireRenaviInternalAdmin],
    schema: {}
  }, listInternalSavedCardMigrationsHandler);

  fastify.get("/internal/admin/saved-card-migrations/:migrationId", {
    preHandler: [fastify.authenticate, ...requireRenaviInternalAdmin],
    schema: {}
  }, getInternalSavedCardMigrationHandler);
};

export default internalAdminSavedCardMigrationRoutes;
