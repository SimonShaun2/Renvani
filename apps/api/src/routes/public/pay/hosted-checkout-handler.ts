import type { FastifyReply, FastifyRequest } from "fastify";

import { checkHostedCheckoutRateLimit } from "../../../lib/public-hosted-checkout-rate-limit.js";
import { createPublicHostedCheckout } from "../../../services/hosted-checkout.service.js";

type TokenParams = { token: string };

export async function createPublicHostedCheckoutHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as TokenParams;
  const origin = typeof request.headers.origin === "string" ? request.headers.origin : null;
  const result = await createPublicHostedCheckout(params.token, origin);
  return reply.header("Cache-Control", "no-store").send(result);
}

/** Per-IP and per-token limit on unauthenticated Stripe session creation (429 + Retry-After). */
export async function hostedCheckoutRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { token } = request.params as TokenParams;
  const limit = await checkHostedCheckoutRateLimit(request.ip, token);
  if (!limit.allowed) {
    await reply
      .status(429)
      .header("Retry-After", String(limit.retryAfterSeconds))
      .header("Cache-Control", "no-store")
      .send({
        error: "RATE_LIMITED",
        message: "Too many checkout attempts. Please try again later.",
        requestId: request.id
      });
  }
}
