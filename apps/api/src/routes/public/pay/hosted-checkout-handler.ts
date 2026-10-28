import type { FastifyReply, FastifyRequest } from "fastify";

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
