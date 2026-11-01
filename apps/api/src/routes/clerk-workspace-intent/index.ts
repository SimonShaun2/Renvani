import type { FastifyPluginAsync, FastifyRequest } from "fastify";

import { enqueueClerkWorkspaceCreateJob, enqueueClerkWorkspaceReconcileJob } from "@fsm/jobs";
import { AppError, ErrorCode, ReserveClerkWorkspaceIntentBodySchema } from "@fsm/types";

import { verifyClerkBearerToken } from "../../lib/clerk-auth.js";
import { getClerkWorkspaceIntent, reserveClerkWorkspaceIntent } from "../../services/clerk-workspace-intent.service.js";

async function clerkSubject(request: FastifyRequest): Promise<string> {
  const [scheme, token] = (request.headers.authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token) throw new AppError(ErrorCode.UNAUTHORIZED, "Missing access token");
  const session = await verifyClerkBearerToken(token, { requireOrganization: false });
  if (session.clerkOrganizationId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Workspace bootstrap requires an organization-free session");
  }
  return session.clerkUserId;
}

/** Pre-tenant bootstrap: reserve and enqueue; the worker owns Clerk creation and reconciliation. */
const clerkWorkspaceIntentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/workspace-intent", async (request, reply) => {
    const userId = await clerkSubject(request);
    reply.header("cache-control", "no-store");
    return reply.send({ intent: await getClerkWorkspaceIntent(userId) });
  });

  fastify.post("/workspace-intent", async (request, reply) => {
    const userId = await clerkSubject(request);
    const body = ReserveClerkWorkspaceIntentBodySchema.parse(request.body);
    const intent = await reserveClerkWorkspaceIntent(userId, body.name);
    if (intent.status === "pending") {
      await enqueueClerkWorkspaceCreateJob({ intentId: intent.id, clerkUserId: userId });
    } else if (intent.status === "claimed" || intent.status === "uncertain") {
      await enqueueClerkWorkspaceReconcileJob({ intentId: intent.id, clerkUserId: userId });
    }
    reply.header("cache-control", "no-store");
    return reply.send({ intent });
  });
};

export default clerkWorkspaceIntentRoutes;
