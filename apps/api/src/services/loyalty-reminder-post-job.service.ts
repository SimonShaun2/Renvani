import { emitEvent } from "@fsm/db";
import { enqueueEvaluateLoyaltyReminderCandidatesJob } from "@fsm/jobs";
import { featureFlags } from "@fsm/config/feature-flags";
import {
  buildLoyaltyReminderEvaluationReceiptV1,
  buildPostJobLoyaltyReminderEvaluationIdempotencyKey,
  type LoyaltyReminderEvaluationReceiptV1
} from "@fsm/types";

export type EnqueuePostJobLoyaltyReminderEvaluationInput = {
  companyId: string;
  customerId: string;
  triggerJobId: string;
};

export async function enqueuePostJobLoyaltyReminderEvaluation(
  input: EnqueuePostJobLoyaltyReminderEvaluationInput
): Promise<"scheduled" | "skipped_disabled"> {
  const idempotencyKey = buildPostJobLoyaltyReminderEvaluationIdempotencyKey(
    input.companyId,
    input.triggerJobId
  );

  if (!featureFlags.loyaltyRemindersEnabled) {
    return "skipped_disabled";
  }

  await enqueueEvaluateLoyaltyReminderCandidatesJob({
    companyId: input.companyId,
    customerId: input.customerId,
    triggerJobId: input.triggerJobId,
    idempotencyKey,
    dryRun: featureFlags.loyaltyRemindersDryRun,
    horizonDays: 14
  });

  await emitLoyaltyReminderEvaluationReceipt({
    ...input,
    idempotencyKey,
    state: "scheduled"
  });

  return "scheduled";
}

async function emitLoyaltyReminderEvaluationReceipt(
  input: EnqueuePostJobLoyaltyReminderEvaluationInput & {
    idempotencyKey: string;
    state: LoyaltyReminderEvaluationReceiptV1["state"];
    candidateCount?: number;
    createdRecommendations?: number;
  }
): Promise<void> {
  const receipt = buildLoyaltyReminderEvaluationReceiptV1({
    idempotencyKey: input.idempotencyKey,
    trigger: "post_job_completed",
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
    entityType: "job",
    entityId: input.triggerJobId,
    customerId: input.customerId,
    jobId: input.triggerJobId,
    payload: receipt,
    summary: `Loyalty reminder evaluation ${input.state} (post-job)`
  });
}
