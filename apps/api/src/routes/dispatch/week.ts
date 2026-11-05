import type { FastifyPluginAsync } from "fastify";
import { DispatchWeekQuerySchema, type DispatchWeekQuery } from "@fsm/types";
import { requireRole } from "../../lib/authorize.js";
import { getDispatchWeek } from "../../services/dispatch-week.service.js";
import { withZodValidation } from "../shared/validation.js";

export const dispatchWeekRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/dispatch/week",
    {
      preHandler: [
        fastify.authenticate,
        requireRole(["owner", "admin", "dispatcher", "office"]),
      ],
      preValidation: [withZodValidation({ query: DispatchWeekQuerySchema })],
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
