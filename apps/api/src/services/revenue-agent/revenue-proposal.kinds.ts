import { and, eq, isNull } from "drizzle-orm";

import { aiRecommendations, emitEventWithExecutor } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import { registerAgentActionType } from "../agent-action.registry.js";
import {
  authorizeOutboundAgentActionExecution,
  registerAgentActionExecutor,
  type AgentActionExecutionContext,
  type AgentActionRejectContext
} from "../agent-action.executors.js";
import { invalidateRevenueSummaryCache } from "../ai-revenue.service.js";
import {
  buildDefaultRevenueProposalParameters,
  registerRevenueProposalBuilder
} from "./revenue-proposal-builders.registry.js";

/**
 * Built-in Revenue Agent proposal kinds. One entry per kind: agent-action type (registry),
 * recommendation builder, and executor. Add a kind by calling `registerRevenueProposalKind`.
 */
export interface RevenueProposalKind {
  actionType: string;
  fromRecommendationType: string;
  consentScope: "appointment" | "marketing";
  consequences: string[];
}

const COMMON_CONSEQUENCES = [
  "Marks the source revenue recommendation as actioned and records the approved draft in the receipt.",
  "No live provider send in this slice; customer consent and policy checks are enforced at execute."
];

function recommendationIdOf(parameters: Record<string, unknown>): string {
  const id = parameters.recommendationId;
  if (typeof id !== "string" || id.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Proposal is missing its recommendation");
  }
  return id;
}

async function transitionRecommendation(
  ctx: AgentActionExecutionContext | AgentActionRejectContext,
  next: "actioned" | "dismissed",
  options: { required: boolean }
): Promise<void> {
  const recommendationId = recommendationIdOf(ctx.parameters);
  const now = new Date();
  const scoped = and(
    eq(aiRecommendations.companyId, ctx.companyId),
    eq(aiRecommendations.id, recommendationId),
    isNull(aiRecommendations.deletedAt)
  );
  const [current] = await ctx.tx.select().from(aiRecommendations).where(scoped).limit(1);
  if (!current || current.companyId !== ctx.companyId || current.status !== "pending") {
    if (options.required) {
      throw new AppError(ErrorCode.CONFLICT, "Recommendation is no longer pending");
    }
    return;
  }

  const [updated] = await ctx.tx
    .update(aiRecommendations)
    .set(
      next === "actioned"
        ? { status: "actioned", actionedAt: now, actionedById: ctx.actorId, snoozedUntil: null, updatedAt: now }
        : { status: "dismissed", dismissedAt: now, snoozedUntil: null, updatedAt: now }
    )
    .where(scoped)
    .returning();
  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, "AI recommendation not found");
  }

  await emitEventWithExecutor(ctx.tx, {
    companyId: ctx.companyId,
    eventType: next === "actioned" ? "ai.recommendation_actioned" : "ai.recommendation_dismissed",
    actorId: ctx.actorId,
    actorType: "user",
    entityType: "ai_recommendation",
    entityId: updated.id,
    customerId: updated.customerId ?? undefined,
    jobId: updated.jobId ?? undefined,
    estimateId: updated.estimateId ?? undefined,
    invoiceId: updated.invoiceId ?? undefined,
    payload: { agentActionId: ctx.actionId, actionType: ctx.actionType },
    summary: `AI recommendation ${next} via agent proposal: ${updated.headline}`
  });
  await invalidateRevenueSummaryCache(ctx.companyId);
}

export function registerRevenueProposalKind(kind: RevenueProposalKind): void {
  registerAgentActionType({
    actionType: kind.actionType,
    agentProduct: "revenue",
    aiMayPropose: true,
    editable: true,
    risk: "high",
    consequences: [...kind.consequences, ...COMMON_CONSEQUENCES],
    fromRecommendationType: kind.fromRecommendationType
  });
  registerRevenueProposalBuilder({
    recommendationType: kind.fromRecommendationType,
    actionType: kind.actionType,
    build: (input) => buildDefaultRevenueProposalParameters(input, { consentScope: kind.consentScope })
  });
  registerAgentActionExecutor(kind.actionType, {
    beforeExecute: authorizeOutboundAgentActionExecution,
    applyInTransaction: (ctx) => transitionRecommendation(ctx, "actioned", { required: true }),
    onRejectInTransaction: (ctx) => transitionRecommendation(ctx, "dismissed", { required: false })
  });
}

for (const kind of [
  {
    actionType: "revenue.invoice_reminder.propose",
    fromRecommendationType: "unpaid_invoice",
    consentScope: "appointment",
    consequences: ["Sends the customer a reminder about an unpaid invoice once executed."]
  },
  {
    actionType: "revenue.estimate_followup.propose",
    fromRecommendationType: "unsold_estimate",
    consentScope: "appointment",
    consequences: ["Follows up with the customer on an open estimate once executed."]
  },
  {
    actionType: "revenue.reactivation.propose",
    fromRecommendationType: "reactivation",
    consentScope: "marketing",
    consequences: ["Reaches out to a dormant customer (marketing consent required)."]
  },
  {
    actionType: "revenue.plan_offer.propose",
    fromRecommendationType: "maintenance_plan_offer",
    consentScope: "marketing",
    consequences: ["Offers the customer a maintenance plan (marketing consent required)."]
  }
] satisfies RevenueProposalKind[]) {
  registerRevenueProposalKind(kind);
}
