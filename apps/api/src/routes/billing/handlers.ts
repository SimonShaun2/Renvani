import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createPlatformBillingCheckout,
  getPlatformBillingStatus
} from "../../services/stripe-platform-billing.service.js";

export async function getPlatformBillingStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const status = await getPlatformBillingStatus(request.company.id);
  return reply.send(status);
}

export async function createPlatformBillingCheckoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const body = (request.body ?? {}) as { plan?: string };
  const plan = body.plan === "flat" ? "flat" : "flex";
  const result = await createPlatformBillingCheckout(request.company.id, request.user.email, plan);
  return reply.send(result);
}
