import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  getQboConnectionStatusHandler,
  qboConnectCallbackHandler,
  startQboConnectHandler,
  triggerQboSyncHandler
} from "./handlers.js";

const quickbooksOnlineRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;

  fastify.get("/quickbooks-online/connect/status", {
    preHandler: [authenticate, requireRole(["owner", "admin"])]
  }, getQboConnectionStatusHandler);

  fastify.post("/quickbooks-online/connect/start", {
    preHandler: [authenticate, requireRole(["owner"])]
  }, startQboConnectHandler);

  fastify.get("/quickbooks-online/connect/callback", {
    preHandler: [authenticate, requireRole(["owner"])]
  }, qboConnectCallbackHandler);

  fastify.post("/quickbooks-online/sync/trigger", {
    preHandler: [authenticate, requireRole(["owner", "admin"])]
  }, triggerQboSyncHandler);
};

export default quickbooksOnlineRoutes;
