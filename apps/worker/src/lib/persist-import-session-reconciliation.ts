import { uploadFile } from "@fsm/config/storage";
import { db, importSessions } from "@fsm/db";
import {
  buildImportReconciliationSkippedRowsObjectKey,
  buildImportSessionReconciliationReport,
  buildSkippedRowRecordsFromValidationErrors,
  buildSkippedRowsCsvContent,
  mergeReconciliationReportIntoAiInferences,
  type ImportSessionReconciliationInput
} from "@fsm/import-engine";
import type { ValidationError } from "@fsm/types";
import { and, eq, isNull } from "drizzle-orm";

import pino from "pino";

const logger = pino({ name: "import-session-reconciliation" });

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeImportValidationErrors(value: unknown): ValidationError[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validationErrors: ValidationError[] = [];

  for (const entry of value) {
    if (!isPlainObject(entry)) {
      continue;
    }

    if (
      typeof entry.row === "number" &&
      typeof entry.field === "string" &&
      typeof entry.message === "string" &&
      typeof entry.value === "string"
    ) {
      validationErrors.push({
        row: entry.row,
        field: entry.field,
        message: entry.message,
        value: entry.value
      });
    }
  }

  return validationErrors;
}

type ImportSessionRow = typeof importSessions.$inferSelect;

function toReconciliationInput(
  session: ImportSessionRow,
  validationErrors: ValidationError[]
): ImportSessionReconciliationInput {
  return {
    importSessionId: session.id,
    entityType: session.entityType,
    fileName: session.fileName,
    status: session.status,
    totalRows: session.totalRows,
    importedRows: session.importedRows,
    skippedRows: session.skippedRows,
    duplicateRows: session.duplicateRows,
    errorRows: session.errorRows,
    validationErrors,
    progress: session.progress
  };
}

export async function persistImportSessionReconciliationReport(
  companyId: string,
  session: ImportSessionRow,
  validationErrors: ValidationError[]
): Promise<void> {
  if (session.status !== "completed") {
    return;
  }

  const skippedRecords = buildSkippedRowRecordsFromValidationErrors(validationErrors);
  let skippedRowsCsvObjectKey: string | null = null;

  if (skippedRecords.length > 0) {
    const objectKey = buildImportReconciliationSkippedRowsObjectKey(companyId, session.id);
    const csvBody = buildSkippedRowsCsvContent(skippedRecords);
    await uploadFile(objectKey, Buffer.from(csvBody, "utf8"), "text/csv");
    skippedRowsCsvObjectKey = objectKey;
  }

  const report = buildImportSessionReconciliationReport(
    toReconciliationInput(session, validationErrors),
    skippedRowsCsvObjectKey
  );

  const aiInferences = mergeReconciliationReportIntoAiInferences(session.aiInferences, report);

  await db
    .update(importSessions)
    .set({
      aiInferences,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(importSessions.companyId, companyId),
        eq(importSessions.id, session.id),
        isNull(importSessions.deletedAt)
      )
    )
    .returning();

  logger.info(
    {
      companyId,
      importSessionId: session.id,
      sourceRowCount: report.sourceRowCount,
      committedRowCount: report.committedRowCount,
      skippedRowCount: report.skippedRowCount
    },
    "Persisted import session reconciliation report"
  );
}

/**
 * Best-effort wrapper: the reconciliation report is advisory. A failure to upload the
 * skipped-rows CSV or save the report must never fail (or retry) an import that has
 * already committed, so errors are logged as warnings and swallowed.
 */
export async function persistImportSessionReconciliationReportBestEffort(
  companyId: string,
  session: ImportSessionRow,
  validationErrors: ValidationError[]
): Promise<boolean> {
  try {
    await persistImportSessionReconciliationReport(companyId, session, validationErrors);
    return true;
  } catch (error: unknown) {
    logger.warn(
      {
        companyId,
        importSessionId: session.id,
        err: error instanceof Error ? error.message : String(error)
      },
      "Failed to persist import session reconciliation report (best-effort; import unaffected)"
    );
    return false;
  }
}
