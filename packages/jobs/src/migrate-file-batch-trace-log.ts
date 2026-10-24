import { observeMigrateFileBatchTrace } from "@fsm/observability/migrate-trace";
import pino from "pino";

import {
  type FsMigrateFileBatchTraceLogFields,
  type FsMigrateFileBatchTraceObject,
  type FsMigrateFileBatchTracePhase,
  buildMigrateFileBatchTraceLogFields
} from "@fsm/types";

const logger = pino({
  name: "migrate-file-batch-trace"
});

export interface LogMigrateFileBatchTraceInput {
  phase: FsMigrateFileBatchTracePhase;
  companyId: string;
  importSessionId: string;
  importBundleId: string;
  bullJobId: string;
  batchIndex: number;
  batchesTotal: number;
  idempotencyKey: string;
  objects: FsMigrateFileBatchTraceObject[];
}

export function logMigrateFileBatchTrace(
  input: LogMigrateFileBatchTraceInput,
  message: string
): FsMigrateFileBatchTraceLogFields {
  const fields = buildMigrateFileBatchTraceLogFields(input);
  logger.info(fields, message);
  observeMigrateFileBatchTrace(fields, message);
  return fields;
}
