import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  createConnectAccountSessionHandler,
  createDashboardLinkHandler,
  createOnboardingLinkHandler,
  getConnectStatusHandler,
  handleOnboardingReturnHandler,
  provisionTestConnectAccountHandler,
  requireConnectTestProvisionEnabled
} from "./handlers.js";
import {
  stripeConnectAccountSessionSchema,
  stripeConnectOnboardSchema,
  stripeConnectReturnSchema,
  stripeConnectStatusRouteSchema,
  stripeConnectTestProvisionSchema,
  stripeDashboardLinkSchema
} from "./schemas.js";

const stripeRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;

  fastify.post("/connect/onboard", {
    preHandler: [authenticate, requireRole(["owner"])],
    schema: stripeConnectOnboardSchema
  }, createOnboardingLinkHandler);

  fastify.get("/connect/return", {
    preHandler: [authenticate, requireRole(["owner"])],
    schema: stripeConnectReturnSchema
  }, handleOnboardingReturnHandler);

  fastify.get("/connect/status", {
    preHandler: [authenticate, requireRole(["owner", "admin"])],
    schema: stripeConnectStatusRouteSchema
  }, getConnectStatusHandler);

  fastify.post("/connect/dashboard-link", {
    preHandler: [authenticate, requireRole(["owner"])],
    schema: stripeDashboardLinkSchema
  }, createDashboardLinkHandler);

  fastify.post("/connect/account-session", {
    preHandler: [authenticate, requireRole(["owner"])],
    schema: stripeConnectAccountSessionSchema
  }, createConnectAccountSessionHandler);

  fastify.post("/connect/test-provision", {
    preHandler: [requireConnectTestProvisionEnabled, authenticate, requireRole(["owner"])],
    schema: stripeConnectTestProvisionSchema
  }, provisionTestConnectAccountHandler);
};

export default stripeRoutes;
