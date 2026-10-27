import type { FastifyReply, FastifyRequest } from "fastify";

import type { PriceBookItemSearchQuery } from "@fsm/types";

import { searchPriceBookItemsForPicker } from "../../services/import-price-book-line-seed.service.js";

export async function searchPriceBookItemsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const query = request.query as PriceBookItemSearchQuery;
  const items = await searchPriceBookItemsForPicker(request.company.id, query.q);
  return reply.send({ items });
}
