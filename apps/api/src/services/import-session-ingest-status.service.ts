import { and, eq, isNull } from "drizzle-orm";

import { db, importSessions } from "@fsm/db";
import { buildImportSessionIngestStatus } from "../lib/import-ingest-status.js";
import { AppError, ErrorCode, type ImportSessionIngestStatus } from "@fsm/types";

export async function getImportSessionIngestStatus(
  companyId: string,
  importSessionId: string
): Promise<ImportSessionIngestStatus> {
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

  return buildImportSessionIngestStatus({
    id: session.id,
    entityType: session.entityType,
    fileName: session.fileName,
    status: session.status,
    progress: session.progress,
    aiInferences: session.aiInferences,
    importedRows: session.importedRows
  });
}
