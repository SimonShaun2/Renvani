import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { TradeServicesQuerySchema, UpdateCompanyTradeBodySchema, type HomeServiceTrade, type UpdateCompanyTradeBody } from "@fsm/types";

import { requireRole } from "../../lib/authorize.js";
import { getCompanyTrade, listCompanyTradeServices, setCompanyTrade } from "../../services/company-trade.service.js";
import { withZodValidation } from "../shared/validation.js";

const updateTradeValidation = withZodValidation({ body: UpdateCompanyTradeBodySchema });
const tradeServicesValidation = withZodValidation({ query: TradeServicesQuerySchema });

/** Growth: shop trade setting + trade service catalog. Mounted under /api/v1/company. */
export const companyTradeRoutes: FastifyPluginAsync = async (fastify) => {
  const requireOwnerOrAdmin = requireRole(["owner", "admin"]);

  fastify.get("/trade", { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) =>
    reply.send({ trade: await getCompanyTrade(request.company.id) })
  );

  fastify.put(
    "/trade",
    // Role check runs before body validation so non-owner/admin staff get 403, never a 400 that probes the schema.
    { preHandler: [fastify.authenticate, requireOwnerOrAdmin, updateTradeValidation] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as UpdateCompanyTradeBody;
      return reply.send({ trade: await setCompanyTrade(request.company.id, request.user.id, body.trade) });
    }
  );

  fastify.get(
    "/trade/services",
    { preHandler: [fastify.authenticate], preValidation: [tradeServicesValidation] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { trade?: HomeServiceTrade };
      return reply.send(await listCompanyTradeServices(request.company.id, query.trade));
    }
  );
};
