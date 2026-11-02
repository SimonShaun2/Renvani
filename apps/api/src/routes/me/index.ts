import type { FastifyPluginAsync } from "fastify";

import { AppError, ErrorCode } from "@fsm/types";

import { isClerkParallelAuthAvailable, verifyClerkBearerToken } from "../../lib/clerk-auth.js";
import { getClerkCompanyStatus } from "../../services/clerk-company-status.service.js";

/**
 * GET /api/v1/me/company-status — Clerk session only (Bearer Clerk session token).
 * Unlike `authenticate`, it does not 401 when the org has no company or the user isn't mapped yet,
 * so the web app can poll after sign-up instead of routing straight to /no-access.
 */
const meRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/company-status", async (request, reply) => {
    const [scheme, token] = (request.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new AppError(ErrorCode.UNAUTHORIZED, "Missing access token");
    }
    if (!isClerkParallelAuthAvailable()) {
      throw new AppError(ErrorCode.FORBIDDEN, "Clerk authentication is not enabled");
    }
    const session = await verifyClerkBearerToken(token, { requireOrganization: false });
    reply.header("cache-control", "no-store");
    return getClerkCompanyStatus(session);
  });
};

export default meRoutes;
