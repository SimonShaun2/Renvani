import type { FastifyReply, FastifyRequest } from "fastify";

import { getAgreementPortalView } from "../../../services/agreement-portal.service.js";
import type { PortalTokenParams } from "./schemas.js";

export async function getAgreementPortalHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as PortalTokenParams;
  const portal = await getAgreementPortalView(params.token);
  return reply.send(portal);
}
