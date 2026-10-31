import { z } from "zod";

/**
 * Revenue Agent proposals (ai_recommendations → agent_actions). Explicit allowlists: proposal
 * parameters and API responses are `.strict()`, so nothing beyond these fields is stored or returned.
 */
export const RevenueProposalChannelSchema = z.enum(["sms", "email"]);

export const RevenueProposalParametersSchema = z
  .object({
    recommendationId: z.string().uuid(),
    recommendationType: z.string().min(1).max(64),
    channel: RevenueProposalChannelSchema,
    consentScope: z.enum(["appointment", "marketing"]),
    subject: z.string().max(255).nullable(),
    body: z.string().min(1).max(2000),
    headline: z.string().min(1).max(255),
    estimatedRevenue: z.string().nullable(),
    recipient: z.object({ firstName: z.string(), lastName: z.string() }).strict()
  })
  .strict();

export const RevenueProposalSchema = z
  .object({
    id: z.string().uuid(),
    actionType: z.string(),
    state: z.string(),
    requiresApproval: z.boolean(),
    recommendationId: z.string().uuid(),
    headline: z.string(),
    estimatedRevenue: z.string().nullable(),
    proposedContent: z
      .object({ channel: RevenueProposalChannelSchema, subject: z.string().nullable(), body: z.string() })
      .strict(),
    expiresAt: z.string(),
    createdAt: z.string()
  })
  .strict();

export const ProposeRecommendationResponseSchema = z
  .object({ proposal: RevenueProposalSchema, created: z.boolean() })
  .strict();

export const GenerateRevenueProposalsBodySchema = z
  .object({ limit: z.number().int().min(1).max(50).optional() })
  .strict();

export const GenerateRevenueProposalsResponseSchema = z
  .object({
    created: z.number().int(),
    existing: z.number().int(),
    skipped: z.number().int(),
    proposals: z.array(RevenueProposalSchema)
  })
  .strict();

export type RevenueProposalParameters = z.infer<typeof RevenueProposalParametersSchema>;
export type RevenueProposal = z.infer<typeof RevenueProposalSchema>;
export type ProposeRecommendationResponse = z.infer<typeof ProposeRecommendationResponseSchema>;
export type GenerateRevenueProposalsBody = z.infer<typeof GenerateRevenueProposalsBodySchema>;
export type GenerateRevenueProposalsResponse = z.infer<typeof GenerateRevenueProposalsResponseSchema>;
