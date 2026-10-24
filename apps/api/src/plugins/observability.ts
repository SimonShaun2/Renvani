/** FS-43 API request tagging for Sentry (batch 5 / #142). */
import fp from "fastify-plugin";

import { applyNodeObservabilityTags } from "@fsm/observability";

const observabilityPlugin = fp(async (fastify) => {
  fastify.addHook("onRequest", async (request) => {
    applyNodeObservabilityTags({
      requestId: request.id
    });
  });

  fastify.addHook("preHandler", async (request) => {
    applyNodeObservabilityTags({
      requestId: request.id,
      companyId: request.company?.id ?? null
    });
  });

});

export default observabilityPlugin;
