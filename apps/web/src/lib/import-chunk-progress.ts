import {
  ImportSessionChunkProgressSchema,
  type ImportSessionChunkProgress
} from "@fsm/types";

export function coerceImportSessionChunkProgress(value: unknown): ImportSessionChunkProgress | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = ImportSessionChunkProgressSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const { entityType, chunksTotal, chunksDone, rowsOk, rowsFailed, lastCursor, lastIdempotencyKey } =
    parsed.data;

  const progress: ImportSessionChunkProgress = {
    entityType,
    chunksTotal,
    chunksDone,
    rowsOk,
    rowsFailed
  };

  if (lastCursor !== undefined) {
    const cursor: NonNullable<ImportSessionChunkProgress["lastCursor"]> = {};
    if (lastCursor.rowOffset !== undefined) {
      cursor.rowOffset = lastCursor.rowOffset;
    }
    if (lastCursor.lastSourceId !== undefined) {
      cursor.lastSourceId = lastCursor.lastSourceId;
    }
    progress.lastCursor = cursor;
  }
  if (lastIdempotencyKey !== undefined) {
    progress.lastIdempotencyKey = lastIdempotencyKey;
  }

  return progress;
}
