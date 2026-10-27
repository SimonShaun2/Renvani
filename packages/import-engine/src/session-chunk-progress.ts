import type { ImportChunkCommitPayload } from "@fsm/types";

export interface ImportChunkSessionProgress {
  entityType?: string;
  chunksTotal?: number;
  chunksDone?: number;
  rowsOk?: number;
  rowsFailed?: number;
  lastCursor?: ImportChunkCommitPayload["cursor"];
  lastIdempotencyKey?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseImportChunkSessionProgress(value: unknown): ImportChunkSessionProgress {
  if (!isPlainObject(value)) {
    return {};
  }

  const progress: ImportChunkSessionProgress = {};

  if (typeof value.entityType === "string") {
    progress.entityType = value.entityType;
  }
  if (typeof value.chunksTotal === "number") {
    progress.chunksTotal = value.chunksTotal;
  }
  if (typeof value.chunksDone === "number") {
    progress.chunksDone = value.chunksDone;
  }
  if (typeof value.rowsOk === "number") {
    progress.rowsOk = value.rowsOk;
  }
  if (typeof value.rowsFailed === "number") {
    progress.rowsFailed = value.rowsFailed;
  }
  if (typeof value.lastIdempotencyKey === "string") {
    progress.lastIdempotencyKey = value.lastIdempotencyKey;
  }
  if (isPlainObject(value.lastCursor)) {
    progress.lastCursor = value.lastCursor as ImportChunkCommitPayload["cursor"];
  }

  return progress;
}

export function mergeImportChunkSessionProgress(
  current: unknown,
  payload: ImportChunkCommitPayload,
  chunkResult: { rowsOk: number; rowsFailed: number },
  incrementChunksDone: boolean,
): ImportChunkSessionProgress {
  const base = parseImportChunkSessionProgress(current);

  return {
    entityType: payload.entityType,
    chunksTotal: payload.chunksTotal,
    chunksDone: (base.chunksDone ?? 0) + (incrementChunksDone ? 1 : 0),
    rowsOk: (base.rowsOk ?? 0) + chunkResult.rowsOk,
    rowsFailed: (base.rowsFailed ?? 0) + chunkResult.rowsFailed,
    lastCursor: payload.cursor,
    lastIdempotencyKey: payload.idempotencyKey,
  };
}
