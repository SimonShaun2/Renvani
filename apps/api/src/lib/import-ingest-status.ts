import {
  ImportSessionChunkProgressSchema,
  type ImportSessionIngestStatus,
  type ImportSessionChunkProgress
} from "@fsm/types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPriceBookLineSeedCount(aiInferences: unknown): number | null {
  if (!isPlainObject(aiInferences)) {
    return null;
  }

  const seeds = aiInferences.priceBookLineSeeds;
  return typeof seeds === "number" && Number.isFinite(seeds) ? seeds : null;
}

export function buildImportSessionIngestStatus(session: {
  id: string;
  entityType: string;
  fileName: string;
  status: string;
  progress: unknown;
  aiInferences: unknown;
  importedRows: number | null;
}): ImportSessionIngestStatus {
  const chunkParsed = ImportSessionChunkProgressSchema.safeParse(session.progress);
  let chunkProgress: ImportSessionChunkProgress | null = null;
  if (chunkParsed.success) {
    const {
      entityType,
      chunksTotal,
      chunksDone,
      rowsOk,
      rowsFailed,
      lastCursor,
      lastIdempotencyKey
    } = chunkParsed.data;
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
    chunkProgress = progress;
  }
  const priceBookLineSeeds =
    session.entityType === "price_book" ? readPriceBookLineSeedCount(session.aiInferences) : null;

  return {
    importSessionId: session.id,
    entityType: session.entityType,
    fileName: session.fileName,
    status: session.status,
    chunkProgress,
    priceBookLineSeeds,
    importedRows: session.importedRows
  };
}
