import * as XLSX from "xlsx";

export interface XlsxSheetRowsResult {
  sheetName: string;
  headers: string[];
  rows: string[][];
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * Parses the first worksheet of an XLSX buffer into header + string rows (M2 ingest prep).
 */
export function parseXlsxBufferToSheetRows(buffer: ArrayBuffer | Uint8Array): XlsxSheetRowsResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("XLSX workbook has no sheets");
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`XLSX workbook missing sheet ${sheetName}`);
  }
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: ""
  });

  if (matrix.length === 0) {
    return { sheetName, headers: [], rows: [] };
  }

  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((cell) => cellToString(cell).trim());
  const rows = matrix.slice(1).map((row) => headers.map((_, index) => cellToString(row[index]).trim()));

  return { sheetName, headers, rows };
}
