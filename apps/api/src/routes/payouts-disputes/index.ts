import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import { getDisputeHandler, getPayoutHandler, listDisputesHandler, listPayoutsHandler } from "./handlers.js";
import {
  getDisputeRouteSchema,
  getDisputeValidation,
  getPayoutRouteSchema,
  getPayoutValidation,
  listDisputesRouteSchema,
  listDisputesValidation,
  listPayoutsRouteSchema,
  listPayoutsValidation
} from "./schemas.js";

/** FS-199: read-only payouts & disputes for the Payments screens. Financial data: owner/admin only. */
const payoutsDisputesRoutes: FastifyPluginAsync = async (fastify) => {
  const financeRoles = [fastify.authenticate, requireRole(["owner", "admin"])];

  fastify.get("/payments/payouts", { preValidation: [listPayoutsValidation], preHandler: financeRoles, schema: listPayoutsRouteSchema }, listPayoutsHandler);
  fastify.get("/payments/payouts/:payoutId", { preValidation: [getPayoutValidation], preHandler: financeRoles, schema: getPayoutRouteSchema }, getPayoutHandler);
  fastify.get("/payments/disputes", { preValidation: [listDisputesValidation], preHandler: financeRoles, schema: listDisputesRouteSchema }, listDisputesHandler);
  fastify.get("/payments/disputes/:disputeId", { preValidation: [getDisputeValidation], preHandler: financeRoles, schema: getDisputeRouteSchema }, getDisputeHandler);
};

export default payoutsDisputesRoutes;
