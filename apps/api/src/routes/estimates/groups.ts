import type { FastifyPluginAsync } from "fastify";
import {
  EstimateGroupsQuerySchema,
  type EstimateGroupsQuery,
} from "@fsm/types";
import { requireRole } from "../../lib/authorize.js";
import { listEstimateGroups } from "../../services/estimate-groups.service.js";
import { withZodValidation } from "../shared/validation.js";

export const estimateGroupRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/groups",
    {
      preHandler: [
        fastify.authenticate,
        requireRole(["owner", "admin", "dispatcher"]),
      ],
      preValidation: [withZodValidation({ query: EstimateGroupsQuerySchema })],
    },
    async (request, reply) =>
      reply.send(
        await listEstimateGroups(
          {
            companyId: request.company.id,
            userId: request.user.id,
            role: request.user.role,
          },
          request.query as EstimateGroupsQuery,
        ),
      ),
  );
};
