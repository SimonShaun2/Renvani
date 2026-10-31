import type { FastifyReply, FastifyRequest } from "fastify";

import {
  customerApproveEstimate,
  customerDeclineEstimate,
  getPublicEstimate,
  getPublicEstimateSchedulingContext
} from "../../../services/estimate.service.js";
import type {
  CustomerApproveBody,
  CustomerDeclineBody,
  TokenParams
} from "./schemas.js";

function toPublicEstimateResponse(estimate: Awaited<ReturnType<typeof getPublicEstimate>>) {
  return {
    estimateNumber: estimate.estimateNumber,
    title: estimate.title,
    status: estimate.status,
    messageToCustomer: estimate.messageToCustomer,
    subtotal: estimate.subtotal,
    taxRate: estimate.taxRate,
    taxAmount: estimate.taxAmount,
    discountAmount: estimate.discountAmount,
    total: estimate.total,
    financingOffered: estimate.financingOffered,
    tierLabel: estimate.tierLabel,
    expiresAt: estimate.expiresAt?.toISOString() ?? null,
    ...(estimate.financing ? { financing: estimate.financing } : {}),
    tiers: estimate.tiers ?? null,
    items: estimate.items
  };
}

export async function getPublicEstimateHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as TokenParams;
  const estimate = await getPublicEstimate(params.token);
  const scheduling =
    estimate.status === "approved" ? await getPublicEstimateSchedulingContext(params.token) : null;

  return reply.send({
    estimate: toPublicEstimateResponse(estimate),
    scheduling
  });
}

export async function customerApproveEstimateHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as TokenParams;
  const body = request.body as CustomerApproveBody;
  await customerApproveEstimate(params.token, body.approvedByName, body.signatureUrl, body.selectedEstimateNumber);

  return reply.send({
    success: true
  });
}

export async function customerDeclineEstimateHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as TokenParams;
  const body = request.body as CustomerDeclineBody;
  await customerDeclineEstimate(params.token, body.reason);

  return reply.send({
    success: true
  });
}
