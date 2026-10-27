import type { CustomerMessageProposalMetadata } from "./proposal-factory-v0_1_2.js";

export const OPERATOR_QUEUE_JOB_NAMES = {
  proposalCreateCustomerMessage: "proposal.create.customer_message",
  retentionGatesAfterCompletionConfirm: "retention-gates.after-completion-confirm",
  retentionGatesWinBackEvaluate: "retention-gates.win-back-evaluate",
  qboSyncPush: "qbo.sync.push",
  qboSyncPull: "qbo.sync.pull"
} as const;

export type OperatorQueueJobName =
  (typeof OPERATOR_QUEUE_JOB_NAMES)[keyof typeof OPERATOR_QUEUE_JOB_NAMES];

export interface ProposalCreateCustomerMessageJobData {
  companyId: string;
  idempotencyKey: string;
  metadata: CustomerMessageProposalMetadata;
  sourceEventIds: string[];
  /** Dry-run / pilot: never deliver to real recipients when true */
  dryRun: boolean;
}

export interface RetentionGatesAfterCompletionConfirmJobData {
  companyId: string;
  jobId: string;
  customerId: string;
  prerequisiteProposalId: string;
  jobCompletedActivityEventId: string;
  maintenanceVisitId?: string | null;
  maintenancePlanId?: string | null;
  dryRun?: boolean;
}

export interface RetentionGatesWinBackEvaluateJobData {
  companyId: string;
  jobId: string;
  customerId: string;
  prerequisiteProposalId: string;
  jobCompletedActivityEventId: string;
  daysSinceLastService: number;
  dryRun?: boolean;
}
