import type { FastifyPluginAsync, FastifyReply, FastifyRequest, FastifySchema } from "fastify";
import { z } from "zod";

import { requireRole } from "../../lib/authorize.js";
import { getJobEta } from "../../services/geo/job-eta.service.js";
import { withZodValidation } from "../shared/validation.js";

export const jobEtaParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const jobEtaQuerySchema = z
  .object({
    originLat: z.coerce.number().min(-90).max(90),
    originLng: z.coerce.number().min(-180).max(180)
  })
  .strict();

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] }) as const;

export const jobEtaRouteSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["eta"],
      properties: {
        eta: {
          type: "object",
          additionalProperties: false,
          required: ["jobId", "provider", "status", "method", "confidence", "minutes", "distanceMiles", "assumedSpeedMph", "unavailableReason"],
          properties: {
            jobId: { type: "string" },
            provider: { type: "string" },
            status: { type: "string" },
            method: nullable("string"),
            confidence: nullable("string"),
            minutes: nullable("integer"),
            distanceMiles: nullable("number"),
            assumedSpeedMph: nullable("number"),
            unavailableReason: nullable("string")
          }
        }
      }
    }
  }
};

async function getJobEtaHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const { id } = request.params as z.infer<typeof jobEtaParamsSchema>;
  const { originLat, originLng } = request.query as z.infer<typeof jobEtaQuerySchema>;
  return reply.send({ eta: await getJobEta(request.company.id, id, { lat: originLat, lng: originLng }) });
}

/** FS-198: GET /api/v1/jobs/:id/eta?originLat&originLng — dispatch + on-the-way ETA (no external calls by default). */
const jobEtaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/:id/eta", {
    preHandler: [fastify.authenticate, requireRole(["owner", "admin", "dispatcher"])],
    preValidation: [withZodValidation({ params: jobEtaParamsSchema, query: jobEtaQuerySchema })],
    schema: jobEtaRouteSchema
  }, getJobEtaHandler);
};

export default jobEtaRoutes;
