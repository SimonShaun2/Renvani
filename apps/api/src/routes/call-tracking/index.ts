import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  callRecordListQuerySchema,
  callTrackingNumberCreateSchema,
  callTrackingNumberUpdateSchema,
  callTrackingSettingsUpdateSchema,
  type CallRecordListQuery,
  type CallTrackingNumberCreate,
  type CallTrackingNumberUpdate,
  type CallTrackingSettingsUpdate
} from "@fsm/types";

import { requireRole } from "../../lib/authorize.js";
import {
  createCallTrackingNumber,
  getCallTrackingSettings,
  listCallRecords,
  listCallTrackingNumbers,
  updateCallTrackingNumber,
  updateCallTrackingSettings
} from "../../services/growth/call-tracking.service.js";
import { withZodValidation } from "../shared/validation.js";

const ownerAdmin = requireRole(["owner", "admin"]);
const numberIdParams = z.object({ numberId: z.string().uuid() }).strict();

/**
 * FS-200 Growth call tracking (owner/admin). Prefix /api/v1/growth/call-tracking.
 * Auth and role run before validation so unauthenticated/forbidden callers never see schema errors.
 */
const callTrackingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/settings", { preHandler: [fastify.authenticate, ownerAdmin] }, async (request: FastifyRequest, reply: FastifyReply) =>
    reply.send({ settings: await getCallTrackingSettings(request.company.id) })
  );

  fastify.put(
    "/settings",
    { preHandler: [fastify.authenticate, ownerAdmin, withZodValidation({ body: callTrackingSettingsUpdateSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) =>
      reply.send({
        settings: await updateCallTrackingSettings(request.company.id, request.user.id, request.body as CallTrackingSettingsUpdate)
      })
  );

  fastify.get("/numbers", { preHandler: [fastify.authenticate, ownerAdmin] }, async (request: FastifyRequest, reply: FastifyReply) =>
    reply.send({ numbers: await listCallTrackingNumbers(request.company.id) })
  );

  fastify.post(
    "/numbers",
    { preHandler: [fastify.authenticate, ownerAdmin, withZodValidation({ body: callTrackingNumberCreateSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) =>
      reply.code(201).send({ number: await createCallTrackingNumber(request.company.id, request.body as CallTrackingNumberCreate) })
  );

  fastify.patch(
    "/numbers/:numberId",
    {
      preHandler: [
        fastify.authenticate,
        ownerAdmin,
        withZodValidation({ params: numberIdParams, body: callTrackingNumberUpdateSchema })
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { numberId } = request.params as { numberId: string };
      return reply.send({
        number: await updateCallTrackingNumber(request.company.id, numberId, request.body as CallTrackingNumberUpdate)
      });
    }
  );

  fastify.get(
    "/calls",
    { preHandler: [fastify.authenticate, ownerAdmin, withZodValidation({ query: callRecordListQuerySchema })] },
    async (request: FastifyRequest, reply: FastifyReply) =>
      reply.send({ calls: await listCallRecords(request.company.id, request.query as CallRecordListQuery) })
  );
};

export default callTrackingRoutes;
