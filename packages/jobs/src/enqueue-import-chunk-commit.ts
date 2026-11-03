import {
  IMPORT_CHUNK_COMMIT_JOB_NAME,
  IMPORT_QUEUE_JOB_NAMES,
  ImportChunkCommitPayloadSchema,
  buildImportChunkCommitJobId,
  type ImportChunkCommitPayload,
} from "@fsm/types";

import { buildDefaultEnqueueJobOptions } from "./queue-policy.js";
import { importsQueue } from "./queues.js";

export async function enqueueImportChunkCommitJob(data: ImportChunkCommitPayload): Promise<void> {
  const payload = ImportChunkCommitPayloadSchema.parse(data);

  await importsQueue.add(
    IMPORT_QUEUE_JOB_NAMES.importChunkCommit,
    payload,
    buildDefaultEnqueueJobOptions({
      jobId: buildImportChunkCommitJobId(payload.importSessionId, payload.chunkIndex),
    }),
  );
}

export { IMPORT_CHUNK_COMMIT_JOB_NAME };
