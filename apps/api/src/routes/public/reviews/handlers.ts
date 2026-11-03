import type { FastifyReply, FastifyRequest } from "fastify";

import type { CompleteReviewRequestInput } from "@fsm/types";

import {
  completePublicReviewRequest,
  getPublicReviewLanding
} from "../../../services/review-request.service.js";
import type {
  ReviewTokenParams,
  ReviewCompleteBody
} from "./schemas.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function getPublicReviewHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as ReviewTokenParams;
  const landing = await getPublicReviewLanding(params.token);

  return reply.send({
    review: landing
  });
}

export async function completePublicReviewHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as ReviewTokenParams;
  const reviewRequest = await completePublicReviewRequest(
    params.token,
    request.body as CompleteReviewRequestInput
  );

  return reply.send({
    reviewRequest: {
      id: reviewRequest.id,
      companyId: reviewRequest.companyId,
      jobId: reviewRequest.jobId,
      customerId: reviewRequest.customerId,
      technicianId: reviewRequest.technicianId,
      referenceId: reviewRequest.referenceId,
      status: reviewRequest.status,
      channel: reviewRequest.channel,
      reviewUrl: reviewRequest.reviewUrl,
      sentAt: toIsoString(reviewRequest.sentAt),
      clickedAt: toIsoString(reviewRequest.clickedAt),
      completedAt: toIsoString(reviewRequest.completedAt),
      rating: reviewRequest.rating,
      reviewText: reviewRequest.reviewText,
      createdAt: reviewRequest.createdAt.toISOString(),
      updatedAt: reviewRequest.updatedAt.toISOString(),
      deletedAt: toIsoString(reviewRequest.deletedAt)
    },
    routing: reviewRequest.routing
  });
}
