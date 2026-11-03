import { and, eq, isNull } from "drizzle-orm";

import { db, importSessions } from "@fsm/db";
import { parseImportChunkSessionProgress } from "@fsm/import-engine";
import {
  AppError,
  ErrorCode,
  ImportSessionChunkProgressSchema,
  type ImportSessionChunkProgress,
  type ImportSessionIngestProgressResponse
} from "@fsm/types";

function toChunkProgress(progress: unknown): ImportSessionChunkProgress | null {
  const parsed = parseImportChunkSessionProgress(progress);

  if (typeof parsed.chunksTotal !== "number" || parsed.chunksTotal <= 0) {
    return null;
  }

  let lastCursor: ImportSessionChunkProgress["lastCursor"];
  if (parsed.lastCursor) {
    const cursor: NonNullable<ImportSessionChunkProgress["lastCursor"]> = {};
    if (typeof parsed.lastCursor.rowOffset === "number") {
      cursor.rowOffset = parsed.lastCursor.rowOffset;
    }
    if (typeof parsed.lastCursor.lastSourceId === "string") {
      cursor.lastSourceId = parsed.lastCursor.lastSourceId;
    }
    if (cursor.rowOffset !== undefined || cursor.lastSourceId !== undefined) {
      lastCursor = cursor;
    }
  }

  const validated = ImportSessionChunkProgressSchema.parse({
    entityType: parsed.entityType ?? "unknown",
    chunksTotal: parsed.chunksTotal,
    chunksDone: parsed.chunksDone ?? 0,
    rowsOk: parsed.rowsOk ?? 0,
    rowsFailed: parsed.rowsFailed ?? 0,
    ...(lastCursor ? { lastCursor } : {}),
    ...(parsed.lastIdempotencyKey ? { lastIdempotencyKey: parsed.lastIdempotencyKey } : {})
  });

  return validated as ImportSessionChunkProgress;
}

export async function getImportSessionIngestProgress(
  companyId: string,
  importSessionId: string
): Promise<ImportSessionIngestProgressResponse> {
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

  return {
    importSessionId: session.id,
    status: session.status,
    entityType: session.entityType,
    fileName: session.fileName,
    chunk: toChunkProgress(session.progress)
  };
}
