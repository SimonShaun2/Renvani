import type { FastifyPluginAsync, FastifyRequest } from "fastify";

import { AppError, ErrorCode, ReserveClerkWorkspaceIntentBodySchema } from "@fsm/types";

import { verifyClerkBearerToken } from "../../lib/clerk-auth.js";
import { getClerkWorkspaceIntent, reserveClerkWorkspaceIntent } from "../../services/clerk-workspace-intent.service.js";

async function clerkSubject(request: FastifyRequest): Promise<string> {
  const [scheme, token] = (request.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token) throw new AppError(ErrorCode.UNAUTHORIZED, "Missing access token");
  const session = await verifyClerkBearerToken(token, { requireOrganization: false });
  return session.clerkUserId;
}

/** Pre-tenant bootstrap only. No Clerk creation, activation, or company provisioning. */
const clerkWorkspaceIntentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/workspace-intent", async (request, reply) => {
    const userId = await clerkSubject(request);
    reply.header("cache-control", "no-store");
    return reply.send({ intent: await getClerkWorkspaceIntent(userId) });
  });

  fastify.post("/workspace-intent", async (request, reply) => {
    const userId = await clerkSubject(request);
    const body = ReserveClerkWorkspaceIntentBodySchema.parse(request.body);
    reply.header("cache-control", "no-store");
    return reply.send({ intent: await reserveClerkWorkspaceIntent(userId, body.name) });
  });
};

export default clerkWorkspaceIntentRoutes;
