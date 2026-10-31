import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { commandCenterBriefQuerySchema, type CommandCenterBriefQuery } from "@fsm/types";

import { requireRole } from "../../lib/authorize.js";
import { getCommandCenterBrief } from "../../services/command-center/command-center-brief.service.js";
import { withZodValidation } from "../shared/validation.js";

/** FS-29: owner/admin only (dispatchers 403). Auth + role run in onRequest, before query validation. Tenant from auth only. */
const ownerOrAdmin = requireRole(["owner", "admin"]);
export const commandCenterBriefValidation = withZodValidation({ query: commandCenterBriefQuerySchema });

export async function getCommandCenterBriefHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const query = request.query as CommandCenterBriefQuery;
  const brief = await getCommandCenterBrief({
    companyId: request.company.id,
    companyTimeZone: request.company.timezone,
    date: query.date,
    timeZone: query.timeZone
  });
  return reply.header("Cache-Control", "private, no-store").send(brief);
}

const commandCenterRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/command-center/brief",
    { onRequest: [fastify.authenticate, ownerOrAdmin], preValidation: [commandCenterBriefValidation] },
    getCommandCenterBriefHandler
  );
};

export default commandCenterRoutes;
