import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  getPublicVipJoinPreview,
  startPublicVipCheckout
} from "../../../services/vip-membership.service.js";

const publicVipRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/join/:token", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { token: string };
    const preview = await getPublicVipJoinPreview(params.token);
    return reply.send(preview);
  });

  fastify.post("/join/:token/checkout", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { token: string };
    const checkout = await startPublicVipCheckout(params.token);
    return reply.code(201).send(checkout);
  });
};

export default publicVipRoutes;
