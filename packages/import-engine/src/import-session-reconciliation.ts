import {
  IMPORT_SESSION_RECONCILIATION_REPORT_KEY,
  ImportSessionReconciliationReportSchema,
  type ImportReconciliationReasonCode,
  type ImportReconciliationReasonSummary,
  type ImportSessionReconciliationReport,
  type ValidationError
} from "@fsm/types";

import { parseImportSessionChunkProgress } from "./session-ingest-status.js";

export interface ImportSessionReconciliationInput {
  importSessionId: string;
  entityType: string;
  fileName: string;
  status: string;
  totalRows: number | null;
  importedRows: number | null;
  skippedRows: number | null;
  duplicateRows: number | null;
  errorRows: number | null;
  validationErrors: ValidationError[];
  progress: unknown;
  computedAt?: Date;
}

export interface SkippedImportRowRecord {
  rowNumber: number;
  reasonCode: ImportReconciliationReasonCode;
  reasonLabel: string;
  detail: string;
}

const REASON_LABELS: Record<ImportReconciliationReasonCode, string> = {
  validation_error: "This row failed validation before import",
  duplicate_skipped: "This row matched an existing record and was skipped",
  chunk_commit_failed: "The worker could not commit this row",
  other_skipped: "This row was skipped during import"
};

export function buildSkippedRowRecordsFromValidationErrors(
  validationErrors: ValidationError[]
): SkippedImportRowRecord[] {
  const byRow = new Map<number, ValidationError[]>();

  for (const entry of validationErrors) {
    const existing = byRow.get(entry.row) ?? [];
    existing.push(entry);
    byRow.set(entry.row, existing);
  }

  return [...byRow.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rowNumber, errors]) => {
      const detail = errors.map((error) => `${error.field}: ${error.message}`).join("; ");
      return {
        rowNumber,
        reasonCode: "validation_error" as const,
        reasonLabel: REASON_LABELS.validation_error,
        detail
      };
    });
}

export function buildImportSessionReconciliationReasonSummaries(
  input: ImportSessionReconciliationInput
): ImportReconciliationReasonSummary[] {
  const validationRowCount = new Set(input.validationErrors.map((entry) => entry.row)).size;
  const skippedRows = input.skippedRows ?? 0;
  const duplicateRows = input.duplicateRows ?? 0;
  const chunkProgress = parseImportSessionChunkProgress(input.progress);
  const chunkFailed = chunkProgress?.rowsFailed ?? 0;

  const duplicateSkipped = Math.min(
    Math.max(0, skippedRows - validationRowCount),
    duplicateRows > 0 ? duplicateRows : skippedRows
  );
  const otherSkipped = Math.max(0, skippedRows - validationRowCount - duplicateSkipped);

  const summaries: ImportReconciliationReasonSummary[] = [];

  if (validationRowCount > 0) {
    summaries.push({
      code: "validation_error",
      label: REASON_LABELS.validation_error,
      count: validationRowCount
    });
  }

  if (duplicateSkipped > 0) {
    summaries.push({
      code: "duplicate_skipped",
      label: REASON_LABELS.duplicate_skipped,
      count: duplicateSkipped
    });
  }

  if (chunkFailed > 0) {
    summaries.push({
      code: "chunk_commit_failed",
      label: REASON_LABELS.chunk_commit_failed,
      count: chunkFailed
    });
  }

  if (otherSkipped > 0) {
    summaries.push({
      code: "other_skipped",
      label: REASON_LABELS.other_skipped,
      count: otherSkipped
    });
  }

  return summaries;
}

export function buildImportSessionReconciliationReport(
  input: ImportSessionReconciliationInput,
  skippedRowsCsvObjectKey: string | null
): ImportSessionReconciliationReport {
  const committedRowCount = Math.max(0, input.importedRows ?? 0);
  const skippedRowCount = Math.max(0, input.skippedRows ?? 0);
  const chunkProgress = parseImportSessionChunkProgress(input.progress);
  const failedRowCount = Math.max(input.errorRows ?? 0, chunkProgress?.rowsFailed ?? 0);

  const inferredSource =
    (input.totalRows ?? 0) > 0
      ? input.totalRows ?? 0
      : committedRowCount + skippedRowCount + failedRowCount;

  const sourceRowCount = Math.max(inferredSource, committedRowCount + skippedRowCount);

  const report = {
    version: 1 as const,
    importSessionId: input.importSessionId,
    entityType: input.entityType,
    fileName: input.fileName,
    status: input.status,
    sourceRowCount,
    committedRowCount,
    skippedRowCount,
    failedRowCount,
    reasonSummaries: buildImportSessionReconciliationReasonSummaries(input),
    skippedRowsCsvObjectKey,
    computedAt: (input.computedAt ?? new Date()).toISOString()
  };

  return ImportSessionReconciliationReportSchema.parse(report);
}

export function buildSkippedRowsCsvContent(records: SkippedImportRowRecord[]): string {
  const header = "row_number,reason_code,reason_label,detail";
  const lines = records.map((record) =>
    [
      String(record.rowNumber),
      record.reasonCode,
      csvEscape(record.reasonLabel),
      csvEscape(record.detail)
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function readImportReconciliationReportFromAiInferences(
  aiInferences: unknown
): ImportSessionReconciliationReport | null {
  if (typeof aiInferences !== "object" || aiInferences === null || Array.isArray(aiInferences)) {
    return null;
  }

  const raw = (aiInferences as Record<string, unknown>)[IMPORT_SESSION_RECONCILIATION_REPORT_KEY];
  const parsed = ImportSessionReconciliationReportSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function mergeReconciliationReportIntoAiInferences(
  aiInferences: unknown,
  report: ImportSessionReconciliationReport
): Record<string, unknown> {
  const base =
    typeof aiInferences === "object" && aiInferences !== null && !Array.isArray(aiInferences)
      ? { ...(aiInferences as Record<string, unknown>) }
      : {};

  return {
    ...base,
    [IMPORT_SESSION_RECONCILIATION_REPORT_KEY]: report
  };
}

export function buildImportReconciliationSkippedRowsObjectKey(
  companyId: string,
  importSessionId: string
): string {
  return `imports/${companyId}/${importSessionId}/skipped-rows.csv`;
}
