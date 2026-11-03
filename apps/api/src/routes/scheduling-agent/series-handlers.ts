import type { FastifyReply, FastifyRequest } from "fastify";

import {
  executeSeriesChange,
  getSeriesDetail,
  previewSeriesChange,
  type ExecuteBody,
  type SeriesChange
} from "../../services/recurring-series-controls.service.js";
import type { SeriesParams } from "./series-schemas.js";

export async function getSeriesHandler(request: FastifyRequest, reply: FastifyReply) {
  const { seriesId } = request.params as SeriesParams;
  return reply.send(await getSeriesDetail(request.company.id, seriesId));
}

export async function previewSeriesChangeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { seriesId } = request.params as SeriesParams;
  const { change } = request.body as { change: SeriesChange };
  return reply.send(await previewSeriesChange(request.company.id, seriesId, change));
}

export async function executeSeriesChangeHandler(request: FastifyRequest, reply: FastifyReply) {
  const { seriesId } = request.params as SeriesParams;
  const actor = { companyId: request.company.id, userId: request.user.id, role: request.user.role };
  return reply.send(await executeSeriesChange(actor, seriesId, request.body as ExecuteBody));
}
