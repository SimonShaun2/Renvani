import fp from "fastify-plugin";

import { getRequestActorOrgContext } from "../lib/request-actor-context.js";
import { requestPathForLog } from "../lib/request-log-path.js";

declare module "fastify" {
  interface FastifyRequest {
    requestStartTime: number;
  }
}

const requestLoggerPlugin = fp(async (fastify) => {
  fastify.decorateRequest("requestStartTime", 0);

  fastify.addHook("onRequest", async (request) => {
    request.requestStartTime = Date.now();
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const durationMs = Date.now() - request.requestStartTime;

    const actorOrg = getRequestActorOrgContext(request);

    request.log.info(
      {
        requestId: request.id,
        companyId: actorOrg.companyId,
        userId: actorOrg.userId,
        role: actorOrg.role,
        authProvider: actorOrg.authProvider,
        method: request.method,
        path: requestPathForLog(request.url),
        statusCode: reply.statusCode,
        durationMs
      },
      "Request completed"
    );
  });
});

export default requestLoggerPlugin;
