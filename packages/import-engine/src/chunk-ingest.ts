import type { ImportRowChunkWindow } from "@fsm/types";

/** Default worker row window size for `import-chunk-commit` (ADR FS-MIGRATE §3). */
export const DEFAULT_IMPORT_ROW_CHUNK_SIZE = 500;

export interface ImportRowChunkPlan {
  chunkIndex: number;
  chunksTotal: number;
  window: ImportRowChunkWindow;
}

export function planImportRowChunks(
  totalDataRows: number,
  chunkSize = DEFAULT_IMPORT_ROW_CHUNK_SIZE
): ImportRowChunkPlan[] {
  if (!Number.isInteger(totalDataRows) || totalDataRows < 0) {
    throw new Error("totalDataRows must be a non-negative integer");
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("chunkSize must be a positive integer");
  }
  if (totalDataRows === 0) {
    return [];
  }

  const chunksTotal = Math.ceil(totalDataRows / chunkSize);
  const plans: ImportRowChunkPlan[] = [];

  for (let chunkIndex = 0; chunkIndex < chunksTotal; chunkIndex += 1) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, totalDataRows);
    plans.push({
      chunkIndex,
      chunksTotal,
      window: { start, end }
    });
  }

  return plans;
}

export function buildImportChunkIdempotencyKey(
  importSessionId: string,
  entityType: string,
  chunkIndex: number
): string {
  return `${importSessionId}:${entityType}:${chunkIndex}`;
}

export function sliceSheetRowsForWindow(rows: string[][], window: ImportRowChunkWindow): string[][] {
  return rows.slice(window.start, window.end);
}
