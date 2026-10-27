import type { FastifyPluginAsync } from "fastify";

import { requireRenaviInternalAdmin } from "../../../lib/require-renavi-internal-admin.js";
import { listQboSyncIssuesHandler, resolveQboSyncIssueHandler } from "./handlers.js";

const internalAdminQboSyncRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/internal/admin/qbo-sync/issues", {
    preHandler: [fastify.authenticate, ...requireRenaviInternalAdmin]
  }, listQboSyncIssuesHandler);

  fastify.post("/internal/admin/qbo-sync/issues/:issueId/resolve", {
    preHandler: [fastify.authenticate, ...requireRenaviInternalAdmin]
  }, resolveQboSyncIssueHandler);
};

export default internalAdminQboSyncRoutes;
