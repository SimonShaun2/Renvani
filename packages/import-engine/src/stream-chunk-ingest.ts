import type { ImportRowChunkWindow } from "@fsm/types";

import {
  DEFAULT_IMPORT_ROW_CHUNK_SIZE,
  planImportRowChunks,
  sliceSheetRowsForWindow,
  type ImportRowChunkPlan
} from "./chunk-ingest.js";

export interface ChunkedSheetRowBatch {
  chunkIndex: number;
  chunksTotal: number;
  window: ImportRowChunkWindow;
  rows: string[][];
}

/**
 * Yields row windows for chunked worker ingest without re-parsing the workbook per chunk.
 */
export function iterateSheetRowChunks(
  rows: string[][],
  chunkSize = DEFAULT_IMPORT_ROW_CHUNK_SIZE
): ChunkedSheetRowBatch[] {
  const plans = planImportRowChunks(rows.length, chunkSize);

  return plans.map((plan: ImportRowChunkPlan) => ({
    chunkIndex: plan.chunkIndex,
    chunksTotal: plan.chunksTotal,
    window: plan.window,
    rows: sliceSheetRowsForWindow(rows, plan.window)
  }));
}
