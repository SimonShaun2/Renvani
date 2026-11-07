import type { FastifyPluginAsync } from "fastify";
import { DispatchWeekQuerySchema, type DispatchWeekQuery } from "@fsm/types";
import { requireRole } from "../../lib/authorize.js";
import { getDispatchWeek } from "../../services/dispatch-week.service.js";
import { withZodValidation } from "../shared/validation.js";

export const dispatchWeekRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/dispatch/week",
    {
      // Auth -> role -> query validation, so signed-out/disallowed callers get 401/403, never 400.
      preHandler: [
        fastify.authenticate,
        requireRole(["owner", "admin", "dispatcher", "office"]),
        withZodValidation({ query: DispatchWeekQuerySchema }),
      ],
    },
    async (request, reply) =>
      reply.send(
        await getDispatchWeek(
          {
            companyId: request.company.id,
            userId: request.user.id,
            role: request.user.role,
          },
          request.query as DispatchWeekQuery,
        ),
      ),
  );
};
