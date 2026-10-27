import { emitEvent } from "@fsm/db";
import { featureFlags } from "@fsm/config/feature-flags";
import {
  buildLoyaltyReminderEvaluationReceiptV1,
  type LoyaltyReminderEvaluationReceiptV1,
  type LoyaltyReminderEvaluationTriggerV1
} from "@fsm/types";

export type EmitLoyaltyReminderEvaluationReceiptInput = {
  companyId: string;
  idempotencyKey: string;
  trigger: LoyaltyReminderEvaluationTriggerV1;
  state: LoyaltyReminderEvaluationReceiptV1["state"];
  customerId?: string;
  triggerJobId?: string;
  candidateCount?: number;
  createdRecommendations?: number;
};

export async function emitLoyaltyReminderEvaluationReceipt(
  input: EmitLoyaltyReminderEvaluationReceiptInput
): Promise<void> {
  const receipt = buildLoyaltyReminderEvaluationReceiptV1({
    idempotencyKey: input.idempotencyKey,
    trigger: input.trigger,
    state: input.state,
    companyId: input.companyId,
    customerId: input.customerId,
    triggerJobId: input.triggerJobId,
    candidateCount: input.candidateCount,
    createdRecommendations: input.createdRecommendations,
    dryRun: featureFlags.loyaltyRemindersDryRun,
    loyaltyRemindersEnabled: featureFlags.loyaltyRemindersEnabled
  });

  await emitEvent({
    companyId: input.companyId,
    actorType: "system",
    eventType: "ai.recommendation_created",
    entityType: input.triggerJobId ? "job" : "company",
    entityId: input.triggerJobId ?? input.companyId,
    customerId: input.customerId,
    jobId: input.triggerJobId,
    payload: receipt,
    summary: `Loyalty reminder evaluation ${input.state}`
  });
}
