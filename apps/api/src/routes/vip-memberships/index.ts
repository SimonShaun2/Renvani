import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  cancelMembershipHandler,
  createCheckoutHandler,
  createJoinLinkHandler,
  createTierHandler,
  deleteTierHandler,
  getPolicyHandler,
  listMembershipsHandler,
  listTiersHandler,
  pauseMembershipHandler,
  updatePolicyHandler,
  updateTierHandler
} from "./handlers.js";
import {
  cancelMembershipValidation,
  checkoutValidation,
  createTierValidation,
  deleteTierValidation,
  pauseMembershipValidation,
  updatePolicyValidation,
  updateTierValidation
} from "./schemas.js";

const vipMembershipRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;
  const requireOwnerOrAdmin = requireRole(["owner", "admin"]);

  fastify.get("/vip/tiers", {
    preHandler: [authenticate, requireOwnerOrAdmin]
  }, listTiersHandler);

  fastify.post("/vip/tiers", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: createTierValidation
  }, createTierHandler);

  fastify.patch("/vip/tiers/:id", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: updateTierValidation
  }, updateTierHandler);

  fastify.delete("/vip/tiers/:id", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: deleteTierValidation
  }, deleteTierHandler);

  fastify.get("/vip/policy", {
    preHandler: [authenticate, requireOwnerOrAdmin]
  }, getPolicyHandler);

  fastify.patch("/vip/policy", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: updatePolicyValidation
  }, updatePolicyHandler);

  fastify.get("/vip/memberships", {
    preHandler: [authenticate, requireOwnerOrAdmin]
  }, listMembershipsHandler);

  fastify.post("/vip/memberships/checkout", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: checkoutValidation
  }, createCheckoutHandler);

  fastify.post("/vip/memberships/join-link", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: checkoutValidation
  }, createJoinLinkHandler);

  fastify.post("/vip/memberships/:id/pause", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: pauseMembershipValidation
  }, pauseMembershipHandler);

  fastify.post("/vip/memberships/:id/cancel", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: cancelMembershipValidation
  }, cancelMembershipHandler);
};

export default vipMembershipRoutes;
