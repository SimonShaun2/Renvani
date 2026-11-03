import {
  AI_QUEUE_JOB_NAMES,
  importFileLinkJobDataSchema,
  buildImportFileLinkJobId,
  type ImportFileLinkJobData
} from "@fsm/types";

import { buildDefaultEnqueueJobOptions } from "./queue-policy.js";
import { aiQueue } from "./queues.js";

export async function enqueueImportFileLinkJob(data: ImportFileLinkJobData): Promise<void> {
  const payload = importFileLinkJobDataSchema.parse(data);
  const bullJobId = buildImportFileLinkJobId(payload.importBundleId);

  await aiQueue.add(
    AI_QUEUE_JOB_NAMES.importFileLink,
    payload,
    buildDefaultEnqueueJobOptions({
      jobId: bullJobId
    })
  );
}
