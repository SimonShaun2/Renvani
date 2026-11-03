import { z } from "zod";

export const OPERATOR_INBOX_UI_VERSION = "0.1.0";

export const OperatorInboxRiskLevelSchema = z.enum(["low", "medium", "high"]);
export type OperatorInboxRiskLevel = z.infer<typeof OperatorInboxRiskLevelSchema>;

export const OperatorOverridePathSchema = z.enum(["approve", "reject", "edit", "execute", "escalate"]);
export type OperatorOverridePath = z.infer<typeof OperatorOverridePathSchema>;

export const OperatorInboxRecipientSchema = z.object({
  displayName: z.string(),
  channel: z.enum(["sms", "email"]).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional()
});

export type OperatorInboxRecipient = z.infer<typeof OperatorInboxRecipientSchema>;

export const OperatorInboxProvenanceEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  summary: z.string(),
  createdAt: z.string()
});

export type OperatorInboxProvenanceEvent = z.infer<typeof OperatorInboxProvenanceEventSchema>;

export const OperatorInboxProvenanceSchema = z.object({
  agentProduct: z.string(),
  actionType: z.string(),
  sourceEventIds: z.array(z.string().uuid()),
  sourceEvents: z.array(OperatorInboxProvenanceEventSchema),
  createdAt: z.string(),
  reason: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  policyVersion: z.string()
});

export type OperatorInboxProvenance = z.infer<typeof OperatorInboxProvenanceSchema>;

export const OperatorInboxProposedContentSchema = z.object({
  channel: z.enum(["sms", "email"]).optional(),
  subject: z.string().nullable().optional(),
  body: z.string()
});

export type OperatorInboxProposedContent = z.infer<typeof OperatorInboxProposedContentSchema>;

export const OperatorInboxItemSchema = z.object({
  contractVersion: z.literal(OPERATOR_INBOX_UI_VERSION),
  id: z.string().uuid(),
  state: z.string(),
  risk: OperatorInboxRiskLevelSchema,
  recipient: OperatorInboxRecipientSchema,
  proposedContent: OperatorInboxProposedContentSchema,
  consequences: z.array(z.string()),
  expiresAt: z.string(),
  overridePaths: z.array(OperatorOverridePathSchema),
  requiresApproval: z.boolean(),
  provenance: OperatorInboxProvenanceSchema,
  executionReceipt: z.record(z.unknown()).nullable().optional(),
  reviewerId: z.string().uuid().nullable().optional(),
  /** Optimistic-concurrency token (updatedAt ms); send back as expectedVersion. */
  version: z.number().int().nonnegative().optional(),
  /** Tenant-sequential display number, e.g. "P-0042" (creation order, stable). */
  proposalNumber: z.string().optional(),
  /** 1 + number of operator edits. */
  proposalVersion: z.number().int().positive().optional(),
  pricing: z.lazy(() => OperatorInboxPricingSchema).optional(),
  checks: z.lazy(() => OperatorInboxChecksSchema).optional()
});

export type OperatorInboxItem = z.infer<typeof OperatorInboxItemSchema>;

export const EditAgentActionParametersSchema = z.object({
  channel: z.enum(["sms", "email"]).optional(),
  subject: z.string().max(998).nullable().optional(),
  body: z.string().min(1).max(16000),
  /** Optimistic-concurrency token (the item's `version`); a stale value is rejected with 409. */
  expectedVersion: z.number().int().nonnegative().optional()
});

export type EditAgentActionParametersInput = z.infer<typeof EditAgentActionParametersSchema>;

/**
 * Card/detail data read from proposal parameters. Config-driven: each field lists the parameter keys
 * it may come from (first non-empty wins). Add a field or key here, not in the mapper.
 */
export const OPERATOR_INBOX_DETAIL_FIELDS = {
  pricing: {
    amount: ["price", "amount", "estimatedRevenue"],
    priceRule: ["priceRule"],
    discount: ["discount"]
  },
  checks: {
    serviceArea: ["serviceArea"],
    optIn: ["optIn", "consentScope"]
  }
} as const;

export const OperatorInboxPricingSchema = z.object({
  amount: z.string().nullable(),
  priceRule: z.string().nullable(),
  discount: z.string().nullable()
});
export type OperatorInboxPricing = z.infer<typeof OperatorInboxPricingSchema>;

export const OperatorInboxChecksSchema = z.object({
  serviceArea: z.string().nullable(),
  optIn: z.string().nullable()
});
export type OperatorInboxChecks = z.infer<typeof OperatorInboxChecksSchema>;

export const OperatorInboxCountsSchema = z.object({
  counts: z.record(z.number().int().nonnegative()),
  total: z.number().int().nonnegative()
});
export type OperatorInboxCounts = z.infer<typeof OperatorInboxCountsSchema>;

export const OperatorInboxTimelineEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  kind: z.string(),
  actorId: z.string().nullable(),
  actorType: z.string().nullable(),
  summary: z.string()
});
export type OperatorInboxTimelineEntry = z.infer<typeof OperatorInboxTimelineEntrySchema>;

export const EscalateAgentActionBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(500).optional(),
    expectedVersion: z.number().int().nonnegative().optional()
  })
  .nullish()
  .transform((value) => value ?? {});
export type EscalateAgentActionBody = z.infer<typeof EscalateAgentActionBodySchema>;
