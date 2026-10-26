import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { requireRole } from "../../lib/authorize.js";
import { adminRelinkClerkUser } from "../../services/clerk-admin-relink.service.js";
import { withZodValidation } from "../shared/validation.js";

export const ClerkRelinkParamsSchema = z.object({ id: z.string().uuid() }).strict();

/** Clerk user ids look like `user_2abc...`. */
export const ClerkRelinkBodySchema = z
  .object({
    clerkUserId: z
      .string()
      .trim()
      .max(255)
      .regex(/^user_[A-Za-z0-9]+$/, "clerkUserId must be a Clerk user id (user_...)"),
    confirmOverwrite: z.boolean().optional().default(false),
    reactivate: z.boolean().optional().default(false)
  })
  .strict();

const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message", "requestId"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" },
    fields: {
      anyOf: [{ type: "object", additionalProperties: { type: "string" } }, { type: "null" }]
    }
  }
} as const;

const clerkRelinkRouteSchema = {
  tags: ["users"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["status", "overwrotePreviousClerkId"],
      properties: {
        status: { type: "string", enum: ["relinked", "unchanged"] },
        overwrotePreviousClerkId: { type: "boolean" }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

const userRoutes: FastifyPluginAsync = async (fastify) => {
  // FS-165: owner/admin relink of a (tombstoned) staff user to a Clerk user id, same company only.
  // Owner/admin targets need an owner actor; self-relink is refused (service).
  fastify.post(
    "/:id/clerk-relink",
    {
      preValidation: [withZodValidation({ params: ClerkRelinkParamsSchema, body: ClerkRelinkBodySchema })],
      preHandler: [fastify.authenticate, requireRole(["owner", "admin"])],
      schema: clerkRelinkRouteSchema
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as z.infer<typeof ClerkRelinkParamsSchema>;
      const body = request.body as z.infer<typeof ClerkRelinkBodySchema>;
      const result = await adminRelinkClerkUser({
        companyId: request.company.id,
        actorUserId: request.user.id,
        actorRole: request.user.role,
        targetUserId: params.id,
        clerkUserId: body.clerkUserId,
        confirmOverwrite: body.confirmOverwrite,
        reactivate: body.reactivate
      });
      return reply.send(result);
    }
  );
};

export default userRoutes;
