import type { FastifyReply, FastifyRequest } from "fastify";

import {
  getDisputeForCompany,
  getPayoutForCompany,
  listDisputesForCompany,
  listPayoutsForCompany
} from "../../services/payouts-disputes.service.js";
import type { DisputeIdParams, ListDisputesQuery, ListPayoutsQuery, PayoutIdParams } from "./schemas.js";

export async function listPayoutsHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const query = request.query as ListPayoutsQuery;
  return reply.send(
    await listPayoutsForCompany(request.company.id, {
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.startingAfter !== undefined ? { startingAfter: query.startingAfter } : {})
    })
  );
}

export async function getPayoutHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const { payoutId } = request.params as PayoutIdParams;
  return reply.send({ data: await getPayoutForCompany(request.company.id, payoutId) });
}

export async function listDisputesHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const query = request.query as ListDisputesQuery;
  return reply.send(
    await listDisputesForCompany(request.company.id, {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.cursor !== undefined ? { cursor: query.cursor } : {})
    })
  );
}

export async function getDisputeHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const { disputeId } = request.params as DisputeIdParams;
  return reply.send({ data: await getDisputeForCompany(request.company.id, disputeId) });
}
