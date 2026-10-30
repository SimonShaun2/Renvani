import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  UpdateEmergencyServiceBodySchema,
  UpdateServiceAreaBodySchema,
  type UpdateEmergencyServiceBody,
  type UpdateServiceAreaBody
} from "@fsm/types";

import { requireRole } from "../../lib/authorize.js";
import {
  getEmergencyService,
  getServiceArea,
  setEmergencyService,
  setServiceArea
} from "../../services/company-home-services.service.js";
import { withZodValidation } from "../shared/validation.js";

const serviceAreaValidation = withZodValidation({ body: UpdateServiceAreaBodySchema });
const emergencyValidation = withZodValidation({ body: UpdateEmergencyServiceBodySchema });

/**
 * Growth (home services) shop settings, mounted under /api/v1/company.
 * Reads: any staff. Writes: owner/admin, role check BEFORE body validation (staff get 403, never 400).
 */
const companyHomeServicesRoutes: FastifyPluginAsync = async (fastify) => {
  const requireOwnerOrAdmin = requireRole(["owner", "admin"]);

  fastify.get("/service-area", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) =>
    reply.send({ serviceArea: await getServiceArea(request.company.id) })
  );

  fastify.put(
    "/service-area",
    { preHandler: [fastify.authenticate, requireOwnerOrAdmin, serviceAreaValidation] },
    async (request: FastifyRequest, reply: FastifyReply) =>
      reply.send({
        serviceArea: await setServiceArea(request.company.id, request.user.id, request.body as UpdateServiceAreaBody)
      })
  );

  fastify.get("/emergency-service", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) =>
    reply.send({ emergencyService: await getEmergencyService(request.company.id) })
  );

  fastify.put(
    "/emergency-service",
    { preHandler: [fastify.authenticate, requireOwnerOrAdmin, emergencyValidation] },
    async (request: FastifyRequest, reply: FastifyReply) =>
      reply.send({
        emergencyService: await setEmergencyService(request.company.id, request.user.id, request.body as UpdateEmergencyServiceBody)
      })
  );
};

export default companyHomeServicesRoutes;
