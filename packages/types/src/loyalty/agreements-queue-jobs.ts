import { z } from "zod";

export const LOYALTY_AGREEMENTS_JOB_NAMES = {
  evaluateReminderCandidates: "evaluate-loyalty-reminder-candidates"
} as const;

export type LoyaltyAgreementsJobName =
  (typeof LOYALTY_AGREEMENTS_JOB_NAMES)[keyof typeof LOYALTY_AGREEMENTS_JOB_NAMES];

export const EvaluateLoyaltyReminderCandidatesJobDataSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  triggerJobId: z.string().uuid().optional(),
  importSessionId: z.string().uuid().optional(),
  horizonDays: z.number().int().positive().max(90).optional(),
  lapsedDays: z.number().int().positive().optional(),
  dryRun: z.boolean().optional(),
  idempotencyKey: z.string().min(1).max(256)
});

export type EvaluateLoyaltyReminderCandidatesJobData = z.infer<
  typeof EvaluateLoyaltyReminderCandidatesJobDataSchema
>;

export function buildPostJobLoyaltyReminderEvaluationJobId(companyId: string, jobId: string): string {
  return `loyalty-reminder-post-job-${companyId}-${jobId}`;
}

export function buildPostJobLoyaltyReminderEvaluationIdempotencyKey(
  companyId: string,
  jobId: string
): string {
  return `loyalty:post-job:${companyId}:${jobId}`;
}

export function assertPostJobLoyaltyReminderIdempotencyKey(
  companyId: string,
  triggerJobId: string,
  idempotencyKey: string
): void {
  const expected = buildPostJobLoyaltyReminderEvaluationIdempotencyKey(companyId, triggerJobId);
  if (idempotencyKey !== expected) {
    throw new Error("evaluate-loyalty-reminder-candidates idempotencyKey does not match post-job trigger");
  }
}
