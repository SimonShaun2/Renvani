import {
  ImportSessionChunkProgressSchema,
  type ImportSessionChunkProgress
} from "@fsm/types";

export interface ImportSessionIngestStatus {
  importSessionId: string;
  entityType: string;
  fileName: string;
  status: string;
  chunkProgress: ImportSessionChunkProgress | null;
  priceBookLineSeeds: number | null;
  importedRows: number | null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseImportSessionChunkProgress(value: unknown): ImportSessionChunkProgress | null {
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

export function readPriceBookLineSeedCount(aiInferences: unknown): number | null {
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
  const chunkProgress = parseImportSessionChunkProgress(session.progress);
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

export function isChunkedHistoryEntity(entityType: string): boolean {
  return entityType === "jobs" || entityType === "estimates";
}
