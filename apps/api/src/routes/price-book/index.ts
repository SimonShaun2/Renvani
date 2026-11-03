import type { FastifyPluginAsync } from "fastify";

import { searchPriceBookItemsHandler } from "./handlers.js";
import { searchPriceBookItemsRouteSchema, searchPriceBookItemsValidation } from "./schemas.js";

const priceBookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/price-book/items/search", {
    preHandler: [fastify.authenticate],
    preValidation: searchPriceBookItemsValidation,
    schema: searchPriceBookItemsRouteSchema
  }, searchPriceBookItemsHandler);
};

export default priceBookRoutes;
