import type { FastifyPluginAsync } from "fastify";

import { getAgreementPortalHandler } from "./handlers.js";
import { getAgreementPortalSchema, publicAgreementPortalValidation } from "./schemas.js";

const publicAgreementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/portal/:token", {
    preValidation: publicAgreementPortalValidation,
    schema: getAgreementPortalSchema
  }, getAgreementPortalHandler);
};

export default publicAgreementRoutes;
