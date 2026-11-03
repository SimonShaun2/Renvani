import type { FastifyReply, FastifyRequest } from "fastify";

import {
  completeQboOAuthCallback,
  getQboConnectionStatus,
  startQboOAuthConnect
} from "../../services/qbo-connection.service.js";
import { enqueueQboFullSync } from "../../services/qbo-sync-engine.service.js";
import { qboConnectCallbackQuerySchema } from "./schemas.js";

export async function getQboConnectionStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const status = await getQboConnectionStatus(request.company.id);
  return reply.send(status);
}

export async function startQboConnectHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = startQboOAuthConnect(request.company.id);
  return reply.send(result);
}

export async function qboConnectCallbackHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = qboConnectCallbackQuerySchema.parse(request.query);
  const status = await completeQboOAuthCallback({
    code: query.code,
    state: query.state,
    realmId: query.realmId,
    actorId: request.user.id
  });
  return reply.send(status);
}

export async function triggerQboSyncHandler(request: FastifyRequest, reply: FastifyReply) {
  await enqueueQboFullSync(request.company.id, request.user.id);
  return reply.code(202).send({ enqueued: true });
}
