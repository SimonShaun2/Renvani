import type { GenerateRevenueProposalsBody } from "@fsm/types";
import {
  generateRevenueProposals,
  proposeFromRecommendation
} from "../../services/revenue-agent/revenue-agent-proposals.service.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ActionRecommendationInput, ListRecommendationsQuery } from "@fsm/types";

import {
  actionRecommendation,
  dismissRecommendation,
  getRecommendation,
  getRevenueSummary,
  listRecommendations,
  snoozeRecommendation
} from "../../services/ai-revenue.service.js";
import type {
  ActionRecommendationBody,
  DismissRecommendationBody,
  LabelPhotoBody,
  ListRecommendationsQueryInput,
  RecommendationIdParams,
  SnoozeRecommendationBody
} from "./schemas.js";

function toListRecommendationsQuery(input: ListRecommendationsQueryInput): ListRecommendationsQuery {
  return {
    status: input.status,
    sortBy: input.sortBy,
    sortOrder: input.sortOrder,
    page: input.page,
    limit: input.limit,
    ...(input.type ? { type: input.type } : {}),
    ...(input.customerId ? { customerId: input.customerId } : {}),
    ...(input.assetId ? { assetId: input.assetId } : {})
  };
}

function toActionRecommendationInput(input: ActionRecommendationBody): ActionRecommendationInput {
  return {
    actionTaken: input.actionTaken,
    ...(input.notes ? { notes: input.notes } : {})
  };
}

function toRecommendationResponse(recommendation: Awaited<ReturnType<typeof getRecommendation>>) {
  return {
    id: recommendation.id,
    type: recommendation.type,
    status: recommendation.status,
    headline: recommendation.headline,
    body: recommendation.body,
    suggestedAction: recommendation.suggestedAction,
    suggestedMessage: recommendation.suggestedMessage,
    estimatedRevenue: recommendation.estimatedRevenue,
    urgencyScore: recommendation.urgencyScore,
    confidenceScore: recommendation.confidenceScore,
    customer: recommendation.customer,
    asset: recommendation.asset
      ? {
          ...recommendation.asset
        }
      : null,
    job: recommendation.job,
    estimate: recommendation.estimate,
    invoice: recommendation.invoice,
    actionedAt: recommendation.actionedAt?.toISOString() ?? null,
    dismissedAt: recommendation.dismissedAt?.toISOString() ?? null,
    snoozedUntil: recommendation.snoozedUntil?.toISOString() ?? null,
    createdAt: recommendation.createdAt.toISOString()
  };
}

export async function getRevenueSummaryHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const summary = await getRevenueSummary(request.company.id);
  return reply.send(summary);
}

export async function listRecommendationsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const result = await listRecommendations(
    request.company.id,
    toListRecommendationsQuery(request.query as ListRecommendationsQueryInput)
  );

  return reply.send({
    data: result.data.map((recommendation) => toRecommendationResponse(recommendation)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  });
}

export async function getRecommendationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as RecommendationIdParams;
  const recommendation = await getRecommendation(request.company.id, params.id);

  return reply.send({
    recommendation: toRecommendationResponse(recommendation)
  });
}

export async function actionRecommendationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as RecommendationIdParams;
  const body = request.body as ActionRecommendationBody;

  await actionRecommendation(
    request.company.id,
    request.user.id,
    params.id,
    toActionRecommendationInput(body)
  );
  const recommendation = await getRecommendation(request.company.id, params.id);

  return reply.send({
    recommendation: toRecommendationResponse(recommendation)
  });
}

export async function dismissRecommendationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as RecommendationIdParams;
  const body = request.body as DismissRecommendationBody;

  await dismissRecommendation(request.company.id, request.user.id, params.id, body.reason);
  const recommendation = await getRecommendation(request.company.id, params.id);

  return reply.send({
    recommendation: toRecommendationResponse(recommendation)
  });
}

export async function snoozeRecommendationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as RecommendationIdParams;
  const body = request.body as SnoozeRecommendationBody;

  await snoozeRecommendation(request.company.id, request.user.id, params.id, body.snoozedUntil);
  const recommendation = await getRecommendation(request.company.id, params.id);

  return reply.send({
    recommendation: toRecommendationResponse(recommendation)
  });
}

export async function labelPhotoHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const body = request.body as LabelPhotoBody;
  const cleanedFileName = body.fileName.replace(/\.[a-z0-9]+$/iu, "").replace(/[-_]+/gu, " ").trim();
  const contextName = body.assetName?.trim() || body.jobTitle?.trim() || cleanedFileName || "Job photo";
  const typeLabel =
    body.photoType === "before"
      ? "Before repair"
      : body.photoType === "after"
        ? "After repair"
        : body.photoType === "document"
          ? "Document"
          : "General photo";
  const label = body.assetName?.trim() || contextName;
  const caption = `${contextName} — ${typeLabel}`;

  return reply.send({
    label,
    caption
  });
}

export async function proposeRecommendationHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as RecommendationIdParams;
  return reply.send(await proposeFromRecommendation(request.company.id, request.user.id, params.id));
}

export async function generateRevenueProposalsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const body = (request.body ?? {}) as GenerateRevenueProposalsBody;
  return reply.send(await generateRevenueProposals(request.company.id, request.user.id, body.limit));
}
