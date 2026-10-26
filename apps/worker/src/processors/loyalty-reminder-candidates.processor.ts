import type { Job, Processor } from "bullmq";
import pino from "pino";

import { featureFlags } from "@fsm/config/feature-flags";
import {
  evaluateLoyaltyReminderCandidatesForCompany,
  syncLoyaltyReminderDryRunRecommendations
} from "@fsm/db";
import {
  EvaluateLoyaltyReminderCandidatesJobDataSchema,
  LOYALTY_AGREEMENTS_JOB_NAMES,
  assertPostJobLoyaltyReminderIdempotencyKey,
  type EvaluateLoyaltyReminderCandidatesJobData
} from "@fsm/types";

import { emitLoyaltyReminderEvaluationReceipt } from "../lib/loyalty-reminder-evaluation-receipt.js";

const logger = pino({
  name: "loyalty-reminder-candidates-processor"
});

export interface LoyaltyReminderCandidatesDependencies {
  evaluateCandidates: typeof evaluateLoyaltyReminderCandidatesForCompany;
  syncDryRunRecommendations: typeof syncLoyaltyReminderDryRunRecommendations;
}

const defaultDependencies: LoyaltyReminderCandidatesDependencies = {
  evaluateCandidates: evaluateLoyaltyReminderCandidatesForCompany,
  syncDryRunRecommendations: syncLoyaltyReminderDryRunRecommendations
};

export async function processEvaluateLoyaltyReminderCandidates(
  job: Job<EvaluateLoyaltyReminderCandidatesJobData>,
  dependencies: LoyaltyReminderCandidatesDependencies = defaultDependencies
): Promise<void> {
  const parsed = EvaluateLoyaltyReminderCandidatesJobDataSchema.safeParse(job.data);
  if (!parsed.success) {
    logger.warn(
      { jobId: job.id ?? null, issues: parsed.error.issues },
      "evaluate-loyalty-reminder-candidates payload failed validation"
    );
    return;
  }

  const payload = parsed.data;
  const companyId = payload.companyId;

  if (payload.triggerJobId) {
    assertPostJobLoyaltyReminderIdempotencyKey(companyId, payload.triggerJobId, payload.idempotencyKey);
  }

  // FEATURE FLAG: loyalty-reminders-enabled — FS-72 dry-run evaluation (no customer sends)
  if (!featureFlags.loyaltyRemindersEnabled) {
    logger.info({ companyId, jobId: job.id ?? null }, "Loyalty reminders disabled; skipping candidate evaluation");
    return;
  }

  const dryRun = payload.dryRun ?? featureFlags.loyaltyRemindersDryRun;
  const horizonDays = payload.horizonDays ?? 14;
  const importSessionId = payload.importSessionId ?? null;
  const trigger: "post_job_completed" | "import_session" | "manual" = payload.triggerJobId
    ? "post_job_completed"
    : importSessionId
      ? "import_session"
      : "manual";

  try {
    const candidates = await dependencies.evaluateCandidates(companyId, {
      horizonDays,
      importSessionId,
      customerId: payload.customerId ?? null,
      ...(payload.lapsedDays !== undefined ? { lapsedDays: payload.lapsedDays } : {}),
      dryRun
    });

    const syncResult = dryRun
      ? await dependencies.syncDryRunRecommendations(companyId, candidates)
      : { createdCount: 0, skippedExistingCount: 0 };

    await job.updateProgress(100);

    await emitLoyaltyReminderEvaluationReceipt({
      companyId,
      idempotencyKey: payload.idempotencyKey,
      trigger,
      state: "completed",
      ...(payload.customerId !== undefined ? { customerId: payload.customerId } : {}),
      ...(payload.triggerJobId !== undefined ? { triggerJobId: payload.triggerJobId } : {}),
      candidateCount: candidates.length,
      createdRecommendations: syncResult.createdCount
    });

    logger.info(
    {
      companyId,
      dryRun,
      importSessionId,
      candidateCount: candidates.length,
      createdRecommendations: syncResult.createdCount,
      skippedExisting: syncResult.skippedExistingCount,
      jobId: job.id ?? null
    },
    "evaluate-loyalty-reminder-candidates completed"
    );
  } catch (error: unknown) {
    await emitLoyaltyReminderEvaluationReceipt({
      companyId,
      idempotencyKey: payload.idempotencyKey,
      trigger,
      state: "failed",
      ...(payload.customerId !== undefined ? { customerId: payload.customerId } : {}),
      ...(payload.triggerJobId !== undefined ? { triggerJobId: payload.triggerJobId } : {})
    });
    throw error;
  }
}

export function createLoyaltyReminderCandidatesProcessor(
  dependencies?: LoyaltyReminderCandidatesDependencies
): Processor<Record<string, unknown>, void, string> {
  return async (job) => {
    if (job.name !== LOYALTY_AGREEMENTS_JOB_NAMES.evaluateReminderCandidates) {
      return;
    }

    await processEvaluateLoyaltyReminderCandidates(
      job as unknown as Job<EvaluateLoyaltyReminderCandidatesJobData>,
      dependencies
    );
  };
}

export const processLoyaltyReminderCandidates = createLoyaltyReminderCandidatesProcessor();
