import { createSignedDownloadUrl } from "@fsm/config/storage";
import { and, eq, isNull } from "drizzle-orm";

import { db, importSessions } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type ImportSessionReconciliationResponse
} from "@fsm/types";

import { readImportReconciliationReportFromAiInferences } from "../lib/import-reconciliation.js";

/**
 * Stored CSV object keys must live under this tenant's import prefix. Anything else
 * (another tenant's key, path traversal, tampered aiInferences) fails closed.
 */
export function isTenantImportObjectKey(companyId: string, objectKey: string): boolean {
  if (!companyId || !objectKey) {
    return false;
  }

  const prefix = `imports/${companyId}/`;
  return (
    objectKey.startsWith(prefix) &&
    objectKey.length > prefix.length &&
    !objectKey.split("/").some((segment) => segment === ".." || segment === ".")
  );
}

export async function getImportSessionReconciliation(
  companyId: string,
  importSessionId: string
): Promise<ImportSessionReconciliationResponse> {
  const [session] = await db
    .select()
    .from(importSessions)
    .where(
      and(
        eq(importSessions.companyId, companyId),
        eq(importSessions.id, importSessionId),
        isNull(importSessions.deletedAt)
      )
    )
    .limit(1);

  if (!session) {
    throw new AppError(ErrorCode.NOT_FOUND, "Import session not found");
  }

  const report = readImportReconciliationReportFromAiInferences(session.aiInferences);

  if (!report) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "Reconciliation report is not available for this import session yet"
    );
  }

  let skippedRowsDownloadUrl: string | null = null;

  if (report.skippedRowsCsvObjectKey && isTenantImportObjectKey(companyId, report.skippedRowsCsvObjectKey)) {
    const signed = await createSignedDownloadUrl(report.skippedRowsCsvObjectKey);
    skippedRowsDownloadUrl = signed.url;
  }

  return {
    report,
    skippedRowsDownloadUrl
  };
}
