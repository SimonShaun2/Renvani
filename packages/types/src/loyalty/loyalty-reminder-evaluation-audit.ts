import { z } from "zod";

import { UuidSchema } from "../agent-control-plane/v1/zod-shared.js";

export const LOYALTY_REMINDER_EVALUATION_CONTRACT_VERSION = "1.0.0";

export const LOYALTY_REMINDER_AGENT_POLICY_V1 = "agent-policy-v1";

export const LoyaltyReminderEvaluationTriggerV1Schema = z.enum([
  "post_job_completed",
  "import_session",
  "manual",
]);

export const LoyaltyReminderEvaluationStateV1Schema = z.enum([
  "scheduled",
  "deduped_completed",
  "completed",
  "skipped_disabled",
  "failed",
]);

export const LoyaltyReminderEvaluationReceiptV1Schema = z.object({
  contractVersion: z.literal(LOYALTY_REMINDER_EVALUATION_CONTRACT_VERSION),
  policyVersion: z.literal(LOYALTY_REMINDER_AGENT_POLICY_V1),
  idempotencyKey: z.string().min(1).max(256),
  trigger: LoyaltyReminderEvaluationTriggerV1Schema,
  state: LoyaltyReminderEvaluationStateV1Schema,
  companyId: UuidSchema,
  customerId: UuidSchema.optional(),
  triggerJobId: UuidSchema.optional(),
  candidateCount: z.number().int().nonnegative().optional(),
  createdRecommendations: z.number().int().nonnegative().optional(),
  dryRun: z.boolean(),
  loyaltyRemindersEnabled: z.boolean(),
});

export type LoyaltyReminderEvaluationTriggerV1 = z.infer<typeof LoyaltyReminderEvaluationTriggerV1Schema>;

export type LoyaltyReminderEvaluationStateV1 = z.infer<typeof LoyaltyReminderEvaluationStateV1Schema>;

export type LoyaltyReminderEvaluationReceiptV1 = z.infer<typeof LoyaltyReminderEvaluationReceiptV1Schema>;

export function buildLoyaltyReminderEvaluationReceiptV1(
  input: Omit<LoyaltyReminderEvaluationReceiptV1, "contractVersion" | "policyVersion">,
): LoyaltyReminderEvaluationReceiptV1 {
  return LoyaltyReminderEvaluationReceiptV1Schema.parse({
    contractVersion: LOYALTY_REMINDER_EVALUATION_CONTRACT_VERSION,
    policyVersion: LOYALTY_REMINDER_AGENT_POLICY_V1,
    ...input,
  });
}
