import type { aiRecommendations, customers } from "@fsm/db";
import { RevenueProposalParametersSchema, type RevenueProposalParameters } from "@fsm/types";

/**
 * Revenue Agent proposal builders, keyed by ai_recommendations.type (text keys, no enums).
 * Each builder turns a tenant-scoped recommendation into allowlisted agent-action parameters.
 */
export type RecommendationRow = typeof aiRecommendations.$inferSelect;
export type CustomerRow = typeof customers.$inferSelect;

export interface RevenueProposalBuilder {
  recommendationType: string;
  /** Registered agent-action type (see revenue-proposal.kinds.ts). */
  actionType: string;
  build: (input: { recommendation: RecommendationRow; customer: CustomerRow }) => RevenueProposalParameters;
}

const builders = new Map<string, RevenueProposalBuilder>();

export function registerRevenueProposalBuilder(builder: RevenueProposalBuilder): void {
  if (!/^[a-z][a-z0-9_]{0,63}$/u.test(builder.recommendationType)) {
    throw new Error(`Invalid recommendation type: ${builder.recommendationType}`);
  }
  builders.set(builder.recommendationType, builder);
}

export function getRevenueProposalBuilder(recommendationType: string): RevenueProposalBuilder | undefined {
  return builders.get(recommendationType);
}

export function listRevenueProposalBuilderTypes(): string[] {
  return [...builders.keys()];
}

/** Test helper. */
export function unregisterRevenueProposalBuilder(recommendationType: string): void {
  builders.delete(recommendationType);
}

/** Shared default: the recommendation's pre-drafted copy, falling back to its body. */
export function buildDefaultRevenueProposalParameters(
  input: { recommendation: RecommendationRow; customer: CustomerRow },
  options: { consentScope: "appointment" | "marketing"; subject?: string | null }
): RevenueProposalParameters {
  const { recommendation, customer } = input;
  const channel = customer.prefersSms === false && customer.email ? "email" : "sms";
  return RevenueProposalParametersSchema.parse({
    recommendationId: recommendation.id,
    recommendationType: recommendation.type,
    channel,
    consentScope: options.consentScope,
    subject: channel === "email" ? (options.subject ?? recommendation.headline) : null,
    body: (recommendation.suggestedMessage?.trim() || recommendation.body).slice(0, 2000),
    headline: recommendation.headline.slice(0, 255),
    estimatedRevenue: recommendation.estimatedRevenue == null ? null : String(recommendation.estimatedRevenue),
    recipient: { firstName: customer.firstName, lastName: customer.lastName }
  });
}
