import type { Job, Processor } from "bullmq";

import { runQboSyncPullJob, runQboSyncPushJob } from "@fsm/db";
import {
  OPERATOR_QUEUE_JOB_NAMES,
  QboSyncPullJobPayloadSchema,
  QboSyncPushJobPayloadSchema
} from "@fsm/types";

export function createQboSyncProcessor(): Processor<Record<string, unknown>, void, string> {
  return async (job) => {
    if (job.name === OPERATOR_QUEUE_JOB_NAMES.qboSyncPush) {
      await runQboSyncPushJob(QboSyncPushJobPayloadSchema.parse(job.data));
      return;
    }
    if (job.name === OPERATOR_QUEUE_JOB_NAMES.qboSyncPull) {
      await runQboSyncPullJob(QboSyncPullJobPayloadSchema.parse(job.data));
    }
  };
}

export async function processQboSyncJob(job: Job<Record<string, unknown>, void, string>): Promise<void> {
  await createQboSyncProcessor()(job);
}
