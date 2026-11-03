import {
  IMPORT_EQUIPMENT_COMMIT_JOB_NAME,
  ImportEquipmentCommitPayloadSchema,
  buildImportEquipmentCommitJobId,
  type ImportEquipmentCommitPayload,
} from "./import-equipment-commit.js";
import { buildDefaultEnqueueJobOptions } from "./queue-policy.js";
import { importsQueue } from "./queues.js";

export async function enqueueImportEquipmentCommitJob(data: ImportEquipmentCommitPayload): Promise<void> {
  const payload = ImportEquipmentCommitPayloadSchema.parse(data);

  await importsQueue.add(
    IMPORT_EQUIPMENT_COMMIT_JOB_NAME,
    payload,
    buildDefaultEnqueueJobOptions({
      jobId: buildImportEquipmentCommitJobId(payload.importSessionId, payload.chunkIndex),
    }),
  );
}
