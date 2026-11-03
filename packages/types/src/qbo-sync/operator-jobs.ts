import type { QboSyncPullJobPayload, QboSyncPushJobPayload } from "./schemas.js";

export const QBO_SYNC_OPERATOR_JOB_NAMES = {
  push: "qbo.sync.push",
  pull: "qbo.sync.pull"
} as const;

export type QboSyncOperatorJobName =
  (typeof QBO_SYNC_OPERATOR_JOB_NAMES)[keyof typeof QBO_SYNC_OPERATOR_JOB_NAMES];

export type QboSyncPushJobData = QboSyncPushJobPayload;
export type QboSyncPullJobData = QboSyncPullJobPayload;
