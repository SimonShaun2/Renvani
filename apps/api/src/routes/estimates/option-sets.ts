/**
 * FS-212 estimate option set routes (good-better-best + disabled financing).
 * owner/admin/dispatcher only, company-scoped; writes need idempotencyKey + expectedVersion.
 */
import {
  estimateOptionSetAddOptionBodySchema,
  estimateOptionSetCreateBodySchema,
  estimateOptionSetUpdateBodySchema,
  estimateOptionSetVersionedBodySchema,
  estimateOptionSetVersionedQuerySchema,
  type EstimateOptionSetAddOptionBody,
  type EstimateOptionSetCreateBody,
  type EstimateOptionSetUpdateBody,
  type EstimateOptionSetVersionedBody
} from "@fsm/types";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { requireRole } from "../../lib/authorize.js";
import {
  addEstimateOption,
  createEstimateOptionSet,
  getEstimateOptionSet,
  getEstimateOptionSetFinancingQuotes,
  removeEstimateOption,
  sendEstimateOptionSet,
  startEstimateOptionSetFinancingApplication,
  updateEstimateOptionSet
} from "../../services/estimate-option-set.service.js";
import { withZodValidation } from "../shared/validation.js";

const optionSetRoles = requireRole(["owner", "admin", "dispatcher"]);
const setParams = z.object({ tierGroupId: z.string().uuid() }).strict();
const optionParams = z.object({ tierGroupId: z.string().uuid(), estimateId: z.string().uuid() }).strict();
const emptyQuery = z.object({}).strict();
const quotesQuery = z.object({ estimateId: z.string().uuid().optional() }).strict();

const actorOf = (request: FastifyRequest) => ({ companyId: request.company.id, userId: request.user.id });
const setIdOf = (request: FastifyRequest) => (request.params as { tierGroupId: string }).tierGroupId;

export function registerEstimateOptionSetRoutes(fastify: FastifyInstance): void {
  const pre = [fastify.authenticate, optionSetRoles];

  fastify.post("/option-sets", {
    preHandler: [...pre, withZodValidation({ body: estimateOptionSetCreateBodySchema })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await createEstimateOptionSet(actorOf(request), request.body as EstimateOptionSetCreateBody);
    return reply.code(result.replayed ? 200 : 201).send(result);
  });

  fastify.get("/option-sets/:tierGroupId", {
    preHandler: [...pre, withZodValidation({ params: setParams, query: emptyQuery })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ optionSet: await getEstimateOptionSet(request.company.id, setIdOf(request)) });
  });

  fastify.patch("/option-sets/:tierGroupId", {
    preHandler: [...pre, withZodValidation({ params: setParams, body: estimateOptionSetUpdateBodySchema })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await updateEstimateOptionSet(actorOf(request), setIdOf(request), request.body as EstimateOptionSetUpdateBody));
  });

  fastify.post("/option-sets/:tierGroupId/options", {
    preHandler: [...pre, withZodValidation({ params: setParams, body: estimateOptionSetAddOptionBodySchema })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await addEstimateOption(actorOf(request), setIdOf(request), request.body as EstimateOptionSetAddOptionBody);
    return reply.code(result.replayed ? 200 : 201).send(result);
  });

  fastify.delete("/option-sets/:tierGroupId/options/:estimateId", {
    preHandler: [...pre, withZodValidation({ params: optionParams, query: estimateOptionSetVersionedQuerySchema })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { estimateId } = request.params as { estimateId: string };
    return reply.send(
      await removeEstimateOption(actorOf(request), setIdOf(request), estimateId, request.query as EstimateOptionSetVersionedBody)
    );
  });

  fastify.post("/option-sets/:tierGroupId/send", {
    preHandler: [...pre, withZodValidation({ params: setParams, body: estimateOptionSetVersionedBodySchema })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await sendEstimateOptionSet(actorOf(request), setIdOf(request), request.body as EstimateOptionSetVersionedBody));
  });

  fastify.get("/option-sets/:tierGroupId/financing-quotes", {
    preHandler: [...pre, withZodValidation({ params: setParams, query: quotesQuery })]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { estimateId } = request.query as { estimateId?: string };
    return reply
      .header("Cache-Control", "no-store")
      .send(await getEstimateOptionSetFinancingQuotes(request.company.id, setIdOf(request), estimateId));
  });

  fastify.post("/option-sets/:tierGroupId/financing-applications", {
    preHandler: [...pre, withZodValidation({ params: setParams })]
  }, async (request: FastifyRequest) => {
    return startEstimateOptionSetFinancingApplication(request.company.id, setIdOf(request));
  });
}
