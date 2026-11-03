import type { Job, Processor } from "bullmq";
import pino from "pino";

import { featureFlags } from "@fsm/config/feature-flags";
import { operatorQueue } from "@fsm/jobs";
import {
  OPERATOR_QUEUE_JOB_NAMES,
  type ProposalCreateCustomerMessageJobData,
  type RetentionGatesAfterCompletionConfirmJobData,
  type RetentionGatesWinBackEvaluateJobData,
  type ServiceBuildJobBriefJobData,
  type RetentionGatesEvaluationInput,
  buildProposalCreateCustomerMessageJob,
  evaluateRetentionGates
} from "@fsm/types";

import { processServiceBuildJobBrief } from "./service-job-brief.processor.js";

const logger = pino({
  name: "retention-gates-processor"
});

export interface RetentionGatesDependencies {
  loadEvaluationInput: (
    data: RetentionGatesAfterCompletionConfirmJobData
  ) => Promise<RetentionGatesEvaluationInput | null>;
  enqueueProposalCreate: (payload: ProposalCreateCustomerMessageJobData) => Promise<void>;
}

const defaultDependencies: RetentionGatesDependencies = {
  loadEvaluationInput: async () => null,
  enqueueProposalCreate: async (payload) => {
    await operatorQueue.add(OPERATOR_QUEUE_JOB_NAMES.proposalCreateCustomerMessage, payload, {
      jobId: payload.idempotencyKey
    });
  }
};

function flagsFromJob(data: { dryRun?: boolean }): {
  retentionGatesEnqueue: boolean;
  retentionWinBackEnqueue: boolean;
  dryRun: boolean;
} {
  return {
    retentionGatesEnqueue: featureFlags.retentionGatesEnqueue,
    retentionWinBackEnqueue: featureFlags.retentionWinBackEnqueue,
    dryRun: data.dryRun ?? true
  };
}

export async function processRetentionGatesAfterCompletionConfirm(
  job: Job<RetentionGatesAfterCompletionConfirmJobData>,
  dependencies: RetentionGatesDependencies = defaultDependencies
): Promise<void> {
  const { retentionGatesEnqueue, dryRun } = flagsFromJob(job.data);

  if (!retentionGatesEnqueue) {
    logger.info(
      { companyId: job.data.companyId, jobId: job.data.jobId },
      "Retention gates enqueue disabled — skipping"
    );
    return;
  }

  const input = await dependencies.loadEvaluationInput(job.data);
  if (!input) {
    logger.warn(
      { companyId: job.data.companyId, jobId: job.data.jobId },
      "Retention gates evaluation input missing — skipping"
    );
    return;
  }

  const evaluation = evaluateRetentionGates(input);

  for (const decision of evaluation.touchpoints) {
    if (!decision.allowed) {
      logger.debug(
        {
          companyId: job.data.companyId,
          jobId: job.data.jobId,
          touchpoint: decision.touchpoint,
          reasonCode: decision.reasonCode
        },
        "Retention touchpoint blocked"
      );
      continue;
    }

    const payload = buildProposalCreateCustomerMessageJob({
      companyId: job.data.companyId,
      jobId: job.data.jobId,
      customerId: job.data.customerId,
      touchpoint: decision.touchpoint,
      prerequisiteProposalId: job.data.prerequisiteProposalId,
      jobCompletedActivityEventId: job.data.jobCompletedActivityEventId,
      automationRuleId: decision.automationRuleId,
      maintenanceVisitId: job.data.maintenanceVisitId ?? null,
      maintenancePlanId: job.data.maintenancePlanId ?? null,
      dryRun
    });

    await dependencies.enqueueProposalCreate(payload);

    logger.info(
      {
        companyId: job.data.companyId,
        jobId: job.data.jobId,
        touchpoint: decision.touchpoint,
        dryRun: payload.dryRun,
        idempotencyKey: payload.idempotencyKey
      },
      "Enqueued retention customer_message proposal create (operator queue)"
    );
  }
}

export async function processRetentionGatesWinBackEvaluate(
  job: Job<RetentionGatesWinBackEvaluateJobData>,
  dependencies: RetentionGatesDependencies = defaultDependencies
): Promise<void> {
  const { retentionWinBackEnqueue, dryRun } = flagsFromJob(job.data);

  if (!retentionWinBackEnqueue) {
    logger.info(
      { companyId: job.data.companyId, customerId: job.data.customerId },
      "Retention win-back enqueue disabled — skipping"
    );
    return;
  }

  const input = await dependencies.loadEvaluationInput({
    companyId: job.data.companyId,
    jobId: job.data.jobId,
    customerId: job.data.customerId,
    prerequisiteProposalId: job.data.prerequisiteProposalId,
    jobCompletedActivityEventId: job.data.jobCompletedActivityEventId,
    ...(job.data.dryRun === undefined ? {} : { dryRun: job.data.dryRun })
  });

  if (!input) {
    return;
  }

  const evaluation = evaluateRetentionGates({
    ...input,
    includeWinBackTouchpoint: true
  });

  const winBack = evaluation.touchpoints.find(
    (row) => row.touchpoint === "retention_win_back_offer"
  );

  if (!winBack?.allowed) {
    logger.debug(
      {
        companyId: job.data.companyId,
        jobId: job.data.jobId,
        reasonCode: winBack?.reasonCode
      },
      "Win-back touchpoint blocked"
    );
    return;
  }

  const payload = buildProposalCreateCustomerMessageJob({
    companyId: job.data.companyId,
    jobId: job.data.jobId,
    customerId: job.data.customerId,
    touchpoint: "retention_win_back_offer",
    prerequisiteProposalId: job.data.prerequisiteProposalId,
    jobCompletedActivityEventId: job.data.jobCompletedActivityEventId,
    automationRuleId: winBack.automationRuleId,
    dryRun
  });

  await dependencies.enqueueProposalCreate(payload);
}

import { processQboSyncJob } from "./qbo-sync.processor.js";

export function createRetentionGatesProcessor(
  dependencies?: RetentionGatesDependencies
): Processor<Record<string, unknown>, void, string> {
  return async (job) => {
    if (
      job.name === OPERATOR_QUEUE_JOB_NAMES.qboSyncPush ||
      job.name === OPERATOR_QUEUE_JOB_NAMES.qboSyncPull
    ) {
      await processQboSyncJob(job);
      return;
    }

    switch (job.name) {
      case OPERATOR_QUEUE_JOB_NAMES.retentionGatesAfterCompletionConfirm:
        await processRetentionGatesAfterCompletionConfirm(
          job as unknown as Job<RetentionGatesAfterCompletionConfirmJobData>,
          dependencies
        );
        return;
      case OPERATOR_QUEUE_JOB_NAMES.retentionGatesWinBackEvaluate:
        await processRetentionGatesWinBackEvaluate(
          job as unknown as Job<RetentionGatesWinBackEvaluateJobData>,
          dependencies
        );
        return;
      case OPERATOR_QUEUE_JOB_NAMES.serviceBuildJobBrief:
        await processServiceBuildJobBrief(job as unknown as Job<ServiceBuildJobBriefJobData>);
        return;
      default:
        return;
    }
  };
}

export const processRetentionGates = createRetentionGatesProcessor();
