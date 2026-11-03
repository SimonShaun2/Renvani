import { listM8ReactivationSignalsFromImportedJobHistory as listM8ReactivationSignalsFromImportedJobHistoryDb } from "@fsm/db";
import type { M8JobHistoryChunkReadInput, M8ReactivationSignal } from "@fsm/types";

/** API service boundary for FS-MIGRATE-M8 migrated job-history reactivation read path. */
export async function listM8ReactivationSignalsFromImportedJobHistory(
  companyId: string,
  input: M8JobHistoryChunkReadInput
): Promise<M8ReactivationSignal[]> {
  return listM8ReactivationSignalsFromImportedJobHistoryDb(companyId, input);
}
