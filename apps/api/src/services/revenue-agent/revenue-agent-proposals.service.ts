import { and, eq, isNull } from "drizzle-orm";

import { agentActions, aiRecommendations, customers, db, runTransactionWithTenantSession } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  RevenueProposalSchema,
  type GenerateRevenueProposalsResponse,
  type ProposeRecommendationResponse,
  type RevenueProposal
} from "@fsm/types";

import { AGENT_POLICY_V1 } from "../agent-action.policy.js";
import { createAgentActionProposal } from "../agent-action.service.js";
import { resolveEntityRef } from "../tenant-context.service.js";
import { getRevenueProposalBuilder, listRevenueProposalBuilderTypes } from "./revenue-proposal-builders.registry.js";
import "./revenue-proposal.kinds.js";

const DEFAULT_GENERATE_LIMIT = 10;

type AgentActionView = Awaited<ReturnType<typeof createAgentActionProposal>>;

export const recommendationIdempotencyKey = (recommendationId: string) => `rec:${recommendationId}`;

/** Allowlisted proposal view (strict zod); never returns company ids, hashes or raw parameters. */
export function toRevenueProposal(action: AgentActionView): RevenueProposal {
  const p = action.parameters;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return RevenueProposalSchema.parse({
    id: action.id,
    actionType: action.actionType,
    state: action.state,
    requiresApproval: action.requiresApproval,
    recommendationId: str(p.recommendationId) ?? "",
    headline: str(p.headline) ?? "",
    estimatedRevenue: str(p.estimatedRevenue),
    proposedContent: {
      channel: p.channel === "email" ? "email" : "sms",
      subject: str(p.subject),
      body: str(p.body) ?? ""
    },
    expiresAt: action.expiresAt,
    createdAt: action.createdAt
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function proposeInTransaction(
  tx: Tx,
  companyId: string,
  actorId: string,
  recommendationId: string
): Promise<{ action: AgentActionView; created: boolean }> {
  const idempotencyKey = recommendationIdempotencyKey(recommendationId);
  const [existing] = await tx
    .select()
    .from(agentActions)
    .where(
      and(
        eq(agentActions.companyId, companyId),
        eq(agentActions.idempotencyKey, idempotencyKey),
        isNull(agentActions.deletedAt)
      )
    )
    .limit(1);

  const [recommendation] = await tx
    .select()
    .from(aiRecommendations)
    .where(
      and(
        eq(aiRecommendations.companyId, companyId),
        eq(aiRecommendations.id, recommendationId),
        isNull(aiRecommendations.deletedAt)
      )
    )
    .limit(1);
  if (!recommendation || recommendation.companyId !== companyId) {
    throw new AppError(ErrorCode.NOT_FOUND, "AI recommendation not found");
  }

  if (existing && existing.companyId === companyId) {
    // Idempotent: one proposal per recommendation (rec:<id>).
    const action = await createAgentActionProposal(
      {
        companyId,
        actorId,
        actorType: "ai",
        agentProduct: "revenue",
        actionType: existing.actionType,
        parameters: existing.parameters as Record<string, unknown>,
        target: existing.target as never,
        idempotencyKey,
        policyVersion: AGENT_POLICY_V1
      },
      tx
    );
    return { action, created: false };
  }

  if (recommendation.status !== "pending") {
    throw new AppError(ErrorCode.CONFLICT, "Recommendation has already been actioned");
  }
  const builder = getRevenueProposalBuilder(recommendation.type);
  if (!builder) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `No Revenue Agent proposal kind for ${recommendation.type}`);
  }
  if (!recommendation.customerId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Recommendation has no customer to contact");
  }

  const [customer] = await tx
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.companyId, companyId),
        eq(customers.id, recommendation.customerId),
        isNull(customers.deletedAt)
      )
    )
    .limit(1);
  if (!customer || customer.companyId !== companyId) {
    throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
  }

  const target = await resolveEntityRef(companyId, "customer", customer.id);
  const action = await createAgentActionProposal(
    {
      companyId,
      actorId,
      actorType: "ai",
      agentProduct: "revenue",
      actionType: builder.actionType,
      parameters: builder.build({ recommendation, customer }),
      target,
      idempotencyKey,
      policyVersion: AGENT_POLICY_V1,
      ...(recommendation.confidenceScore != null ? { confidence: recommendation.confidenceScore / 100 } : {}),
      reason: recommendation.headline
    },
    tx
  );
  return { action, created: true };
}

export async function proposeFromRecommendation(
  companyId: string,
  actorId: string,
  recommendationId: string
): Promise<ProposeRecommendationResponse> {
  const { action, created } = await runTransactionWithTenantSession(companyId, (tx) =>
    proposeInTransaction(tx as Tx, companyId, actorId, recommendationId)
  );
  return { proposal: toRevenueProposal(action), created };
}

export async function generateRevenueProposals(
  companyId: string,
  actorId: string,
  limit: number = DEFAULT_GENERATE_LIMIT
): Promise<GenerateRevenueProposalsResponse> {
  const supported = new Set(listRevenueProposalBuilderTypes());
  const now = Date.now();
  const candidates = await runTransactionWithTenantSession(companyId, async (tx) =>
    (
      await tx
        .select()
        .from(aiRecommendations)
        .where(
          and(
            eq(aiRecommendations.companyId, companyId),
            eq(aiRecommendations.status, "pending"),
            isNull(aiRecommendations.deletedAt)
          )
        )
    )
      .filter((row) => row.companyId === companyId && row.status === "pending")
      .filter((row) => !row.snoozedUntil || row.snoozedUntil.getTime() <= now)
      .filter((row) => !row.expiresAt || row.expiresAt.getTime() > now)
  );

  const eligible = candidates
    .filter((row) => supported.has(row.type) && row.customerId)
    .sort((a, b) => (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0))
    .slice(0, limit);

  const result: GenerateRevenueProposalsResponse = {
    created: 0,
    existing: 0,
    skipped: candidates.length - eligible.length,
    proposals: []
  };
  for (const row of eligible) {
    try {
      const { proposal, created } = await proposeFromRecommendation(companyId, actorId, row.id);
      result[created ? "created" : "existing"] += 1;
      result.proposals.push(proposal);
    } catch (error) {
      if (error instanceof AppError && error.code !== ErrorCode.INTERNAL_ERROR) {
        result.skipped += 1;
        continue;
      }
      throw error;
    }
  }
  return result;
}
