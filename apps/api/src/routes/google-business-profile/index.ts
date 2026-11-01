import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { requireRole } from "../../lib/authorize.js";
import { getGbpStatus, readGbp, setGbpOptIn, type GbpResource } from "../../services/growth/gbp.service.js";
import { withZodValidation } from "../shared/validation.js";

export const gbpOptInBodySchema = z.object({ optIn: z.boolean() }).strict();
export const gbpReadParamsSchema = z.object({ resource: z.enum(["profile", "hours", "services", "reviews"]) }).strict();

const ownerAdmin = requireRole(["owner", "admin"]);

/** Growth: GET/PUT /api/v1/integrations/google-business-profile (status, opt-in) and GET .../:resource (reads). */
const googleBusinessProfileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate, ownerAdmin] }, async (request: FastifyRequest, reply: FastifyReply) =>
    reply.send({ googleBusinessProfile: await getGbpStatus(request.company.id) })
  );

  fastify.put(
    "/opt-in",
    { preHandler: [fastify.authenticate, ownerAdmin], preValidation: [withZodValidation({ body: gbpOptInBodySchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { optIn } = request.body as z.infer<typeof gbpOptInBodySchema>;
      return reply.send({ googleBusinessProfile: await setGbpOptIn(request.company.id, request.user.id, optIn) });
    }
  );

  fastify.get(
    "/:resource",
    { preHandler: [fastify.authenticate, ownerAdmin], preValidation: [withZodValidation({ params: gbpReadParamsSchema })] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { resource } = request.params as { resource: GbpResource };
      return reply.send({ result: await readGbp(request.company.id, resource) });
    }
  );
};

export default googleBusinessProfileRoutes;
