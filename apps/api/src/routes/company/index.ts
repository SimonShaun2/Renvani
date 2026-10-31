import type { FastifyPluginAsync } from "fastify";

import { getCompanyHandler, updateCompanyHandler } from "./handlers.js";
import { companyTradeRoutes } from "./trade.js";
import { getCompanyRouteSchema, updateCompanyRouteSchema, updateCompanyValidation } from "./schemas.js";

const companyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", { preHandler: [fastify.authenticate], schema: getCompanyRouteSchema }, getCompanyHandler);
  fastify.patch(
    "/",
    {
      preHandler: [fastify.authenticate],
      preValidation: [updateCompanyValidation],
      schema: updateCompanyRouteSchema
    },
    updateCompanyHandler
  );
  await fastify.register(companyTradeRoutes);
};

export default companyRoutes;
