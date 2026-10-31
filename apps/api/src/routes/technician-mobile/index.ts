import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  MobileChecklistItemParamsSchema,
  MobileChecklistUpdateBodySchema,
  MobileJobIdParamsSchema,
  MobileOnTheWayBodySchema,
  MobileReportIssueBodySchema,
  MobileStatusBodySchema,
  MobileTodayQuerySchema,
  type MobileChecklistUpdateBody,
  type MobileOnTheWayBody,
  type MobileReportIssueBody,
  type MobileStatusBody,
  type MobileTodayQuery
} from "@fsm/types";

import { requireRole } from "../../lib/authorize.js";
import {
  MobileVersionConflictError,
  getMobileJob,
  getTodayJobs,
  markOnTheWay,
  reportJobIssue,
  updateMobileChecklistItem,
  updateMobileJobStatus,
  type MobileActor
} from "../../services/technician-mobile.service.js";
import { withZodValidation } from "../shared/validation.js";

const mobileRoles = requireRole(["owner", "admin", "dispatcher", "office", "technician"]);

function actorOf(request: FastifyRequest): MobileActor {
  return { companyId: request.company.id, userId: request.user.id, role: request.user.role };
}

async function withConflict<T>(reply: FastifyReply, work: () => Promise<T>, code = 200) {
  try {
    return reply.code(code).send(await work());
  } catch (error) {
    if (error instanceof MobileVersionConflictError) {
      return reply.code(409).send({
        error: "CONFLICT",
        reason: "stale_record_version",
        message: error.message,
        current: error.current
      });
    }
    throw error;
  }
}

const technicianMobileRoutes: FastifyPluginAsync = async (fastify) => {
  const preHandler = [fastify.authenticate, mobileRoles];

  fastify.get("/mobile/today", {
    preHandler,
    preValidation: [withZodValidation({ query: MobileTodayQuerySchema })]
  }, async (request, reply) =>
    reply.send(await getTodayJobs(actorOf(request), request.query as MobileTodayQuery)));

  fastify.get("/mobile/jobs/:id", {
    preHandler,
    preValidation: [withZodValidation({ params: MobileJobIdParamsSchema })]
  }, async (request, reply) =>
    reply.send({ job: await getMobileJob(actorOf(request), (request.params as { id: string }).id) }));

  fastify.post("/mobile/jobs/:id/on-the-way", {
    preHandler,
    preValidation: [withZodValidation({ params: MobileJobIdParamsSchema, body: MobileOnTheWayBodySchema })]
  }, async (request, reply) =>
    withConflict(reply, async () => ({
      job: await markOnTheWay(actorOf(request), (request.params as { id: string }).id, (request.body ?? {}) as MobileOnTheWayBody)
    })));

  fastify.patch("/mobile/jobs/:id/status", {
    preHandler,
    preValidation: [withZodValidation({ params: MobileJobIdParamsSchema, body: MobileStatusBodySchema })]
  }, async (request, reply) =>
    withConflict(reply, async () => ({
      job: await updateMobileJobStatus(actorOf(request), (request.params as { id: string }).id, request.body as MobileStatusBody)
    })));

  fastify.patch("/mobile/jobs/:id/checklist/:taskId", {
    preHandler,
    preValidation: [withZodValidation({ params: MobileChecklistItemParamsSchema, body: MobileChecklistUpdateBodySchema })]
  }, async (request, reply) => {
    const params = request.params as { id: string; taskId: string };
    return withConflict(reply, async () => ({
      item: await updateMobileChecklistItem(actorOf(request), params.id, params.taskId, request.body as MobileChecklistUpdateBody)
    }));
  });

  fastify.post("/mobile/jobs/:id/issues", {
    preHandler,
    preValidation: [withZodValidation({ params: MobileJobIdParamsSchema, body: MobileReportIssueBodySchema })]
  }, async (request, reply) =>
    withConflict(reply, async () =>
      reportJobIssue(actorOf(request), (request.params as { id: string }).id, request.body as MobileReportIssueBody), 201));
};

export default technicianMobileRoutes;
