import {
  OPERATOR_QUEUE_JOB_NAMES,
  type ServiceBuildJobBriefJobData,
  buildServiceJobBriefBuildJobId,
  buildServiceJobBriefIdempotencyKey
} from "@fsm/types";

import { operatorQueue } from "./queues.js";

export type EnqueueBuildJobServiceBriefInput = {
  companyId: string;
  jobId: string;
  sourceEventIds?: string[];
};

export async function enqueueBuildJobServiceBriefJob(
  input: EnqueueBuildJobServiceBriefInput
): Promise<string> {
  const idempotencyKey = buildServiceJobBriefIdempotencyKey(input.companyId, input.jobId);
  const payload: ServiceBuildJobBriefJobData = {
    companyId: input.companyId,
    jobId: input.jobId,
    idempotencyKey,
    sourceEventIds: input.sourceEventIds ?? []
  };

  const jobId = buildServiceJobBriefBuildJobId(input.companyId, input.jobId);
  await operatorQueue.add(OPERATOR_QUEUE_JOB_NAMES.serviceBuildJobBrief, payload, { jobId });
  return jobId;
}
