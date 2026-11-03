import {
  LOYALTY_AGREEMENTS_JOB_NAMES,
  EvaluateLoyaltyReminderCandidatesJobDataSchema,
  buildPostJobLoyaltyReminderEvaluationJobId,
  type EvaluateLoyaltyReminderCandidatesJobData
} from "@fsm/types";

import { buildDefaultEnqueueJobOptions } from "./queue-policy.js";
import { agreementsQueue } from "./queues.js";

export async function enqueueEvaluateLoyaltyReminderCandidatesJob(
  data: EvaluateLoyaltyReminderCandidatesJobData
): Promise<void> {
  const payload = EvaluateLoyaltyReminderCandidatesJobDataSchema.parse(data);
  const jobId =
    payload.triggerJobId !== undefined
      ? buildPostJobLoyaltyReminderEvaluationJobId(payload.companyId, payload.triggerJobId)
      : `loyalty-reminder-eval-${payload.companyId}-${payload.idempotencyKey}`;

  await agreementsQueue.add(
    LOYALTY_AGREEMENTS_JOB_NAMES.evaluateReminderCandidates,
    payload,
    buildDefaultEnqueueJobOptions({ jobId })
  );
}
