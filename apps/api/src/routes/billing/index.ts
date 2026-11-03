import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  createPlatformBillingCheckoutHandler,
  getPlatformBillingStatusHandler
} from "./handlers.js";
import { platformBillingCheckoutSchema, platformBillingStatusSchema } from "./schemas.js";

const billingRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;

  fastify.get("/platform/status", {
    preHandler: [authenticate, requireRole(["owner", "admin"])],
    schema: platformBillingStatusSchema
  }, getPlatformBillingStatusHandler);

  fastify.post("/platform/checkout", {
    preHandler: [authenticate, requireRole(["owner"])],
    schema: platformBillingCheckoutSchema
  }, createPlatformBillingCheckoutHandler);
};

export default billingRoutes;
