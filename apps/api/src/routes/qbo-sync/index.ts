import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  getQboCatalogHandler,
  getQboMappingBoardHandler,
  getQboSyncStatusHandler,
  postQboIssueRetryHandler,
  putQboMappingsHandler
} from "./handlers.js";

const qboSyncRoutes: FastifyPluginAsync = async (fastify) => {
  const ownerAdmin = [fastify.authenticate, requireRole(["owner", "admin"])];

  fastify.get("/qbo-sync/status", { preHandler: ownerAdmin }, getQboSyncStatusHandler);
  fastify.get("/qbo-sync/mappings", { preHandler: ownerAdmin }, getQboMappingBoardHandler);
  fastify.put("/qbo-sync/mappings", { preHandler: ownerAdmin }, putQboMappingsHandler);
  fastify.get("/qbo-sync/catalog", { preHandler: ownerAdmin }, getQboCatalogHandler);
  fastify.post("/qbo-sync/issues/:issueId/retry", { preHandler: ownerAdmin }, postQboIssueRetryHandler);
};

export default qboSyncRoutes;
