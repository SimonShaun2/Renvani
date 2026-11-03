import type { FastifyReply, FastifyRequest } from "fastify";

import { getPublicInvoicePaymentLink } from "../../../services/invoice.service.js";
import type { TokenParams } from "./schemas.js";

export async function getPublicPaymentLinkHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as TokenParams;
  const paymentLink = await getPublicInvoicePaymentLink(params.token);

  return reply.send(paymentLink);
}
