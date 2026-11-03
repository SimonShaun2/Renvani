import { emitEvent } from "@fsm/db";
import {
  buildImportWorkflowStepReceiptV1,
  type ImportWorkflowAuditPayloadV1,
  type ImportWorkflowStepKindV1,
  type ImportWorkflowStepStateV1,
} from "@fsm/types";

export type EmitImportWorkflowStepReceiptInput = {
  companyId: string;
  importSessionId: string;
  stepKind: ImportWorkflowStepKindV1;
  idempotencyKey: string;
  state: ImportWorkflowStepStateV1;
  summary: string;
  importBundleId?: string;
  chunkIndex?: number;
  batchIndex?: number;
  jobId?: string;
};

export async function emitImportWorkflowStepReceipt(
  input: EmitImportWorkflowStepReceiptInput,
): Promise<ImportWorkflowAuditPayloadV1> {
  const receipt = buildImportWorkflowStepReceiptV1({
    stepKind: input.stepKind,
    idempotencyKey: input.idempotencyKey,
    state: input.state,
    importSessionId: input.importSessionId,
    importBundleId: input.importBundleId,
    chunkIndex: input.chunkIndex ?? input.batchIndex,
    jobId: input.jobId,
  });

  await emitEvent({
    companyId: input.companyId,
    actorType: "system",
    eventType: "import.started",
    entityType: "import_session",
    entityId: input.importSessionId,
    payload: receipt,
    summary: input.summary,
  });

  return receipt;
}
