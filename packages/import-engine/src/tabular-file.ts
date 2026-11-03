import { parseXlsxBufferToSheetRows, type XlsxSheetRowsResult } from "./xlsx-to-rows.js";

export function isXlsxImportFileName(fileName: string): boolean {
  return /\.(xlsx|xls)$/iu.test(fileName.trim());
}

/**
 * Parses tabular upload bytes for worker/API ingest. CSV is handled by callers (Papa Parse).
 */
export function parseXlsxImportFile(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string
): XlsxSheetRowsResult {
  if (!isXlsxImportFileName(fileName)) {
    throw new Error(`Expected an XLSX file name, got ${fileName}`);
  }

  return parseXlsxBufferToSheetRows(buffer);
}
