import {
  OPERATOR_QUEUE_JOB_NAMES,
  QboSyncPullJobPayloadSchema,
  QboSyncPushJobPayloadSchema,
  buildQboSyncPullJobId,
  buildQboSyncPushJobId,
  type QboSyncPullJobPayload,
  type QboSyncPushJobPayload
} from "@fsm/types";

import { buildDefaultEnqueueJobOptions } from "./queue-policy.js";
import { operatorQueue } from "./queues.js";

export async function enqueueQboSyncPushJob(data: QboSyncPushJobPayload): Promise<void> {
  const payload = QboSyncPushJobPayloadSchema.parse(data);
  await operatorQueue.add(OPERATOR_QUEUE_JOB_NAMES.qboSyncPush, payload, buildDefaultEnqueueJobOptions({
    jobId: buildQboSyncPushJobId(payload.idempotencyKey)
  }));
}

export async function enqueueQboSyncPullJob(data: QboSyncPullJobPayload): Promise<void> {
  const payload = QboSyncPullJobPayloadSchema.parse(data);
  const windowKey = payload.cdcSince ?? "latest";
  await operatorQueue.add(OPERATOR_QUEUE_JOB_NAMES.qboSyncPull, payload, buildDefaultEnqueueJobOptions({
    jobId: buildQboSyncPullJobId(payload.companyId, windowKey)
  }));
}
