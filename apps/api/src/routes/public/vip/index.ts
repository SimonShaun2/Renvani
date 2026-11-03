import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  VIP_MEMBERSHIP_JOIN_TOKEN_MAX_LENGTH,
  isWellFormedVipMembershipJoinToken
} from "@fsm/config/vip-membership-portal-token";

import { AppError, ErrorCode } from "@fsm/types";

import { checkPublicVipJoinRateLimit } from "../../../lib/public-booking-rate-limit.js";
import {
  getPublicVipJoinPreview,
  startPublicVipCheckout
} from "../../../services/vip-membership.service.js";

/** Audit H3: reject malformed/oversized tokens before HMAC verification. */
const vipJoinParamsSchema = z.object({
  token: z.string().min(1).max(VIP_MEMBERSHIP_JOIN_TOKEN_MAX_LENGTH).refine(isWellFormedVipMembershipJoinToken)
});

async function guardVipJoin(
  request: FastifyRequest,
  reply: FastifyReply,
  action: "preview" | "checkout"
): Promise<string | null> {
  const parsed = vipJoinParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    // Same error as the service's unknown/invalid-signature path, so malformed and unknown look identical.
    throw new AppError(ErrorCode.NOT_FOUND, "Link not found");
  }
  const allowed = await checkPublicVipJoinRateLimit(request.ip, parsed.data.token, action);
  if (!allowed) {
    await reply.status(429).send({
      error: "RATE_LIMITED",
      message: "Too many requests for this link. Please try again later.",
      requestId: request.id
    });
    return null;
  }
  return parsed.data.token;
}

const publicVipRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/join/:token", async (request: FastifyRequest, reply: FastifyReply) => {
    const token = await guardVipJoin(request, reply, "preview");
    if (token === null) return reply;
    const preview = await getPublicVipJoinPreview(token);
    return reply.send(preview);
  });

  fastify.post("/join/:token/checkout", async (request: FastifyRequest, reply: FastifyReply) => {
    const token = await guardVipJoin(request, reply, "checkout");
    if (token === null) return reply;
    const checkout = await startPublicVipCheckout(token);
    return reply.code(201).send(checkout);
  });
};

export default publicVipRoutes;
