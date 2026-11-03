import Papa from "papaparse";

import { sanitizeSpreadsheetCell } from "@fsm/types";

import {
  isQuickBooksIifContent,
  isQuickBooksIifFileName,
  parseQuickBooksIifToTable,
  QUICKBOOKS_IIF_RECORD_TYPE_BY_IMPORT_ENTITY,
} from "./quickbooks-iif.js";
import { sheetRowsToRecordRows } from "./sheet-rows-to-records.js";
import { isXlsxImportFileName } from "./tabular-file.js";
import { parseXlsxBufferToSheetRows } from "./xlsx-to-rows.js";

export interface TabularImportRow {
  rowNumber: number;
  values: Record<string, string>;
}

export function parseTabularImportFile(
  buffer: Buffer | Uint8Array,
  fileName: string,
  /** When set, QuickBooks IIF files are read using this entity's record type (CUST, TRNS, ...). */
  importEntityType?: string,
): { headers: string[]; rows: TabularImportRow[] } {
  if (isXlsxImportFileName(fileName)) {
    const sheet = parseXlsxBufferToSheetRows(buffer);
    const recordRows = sheetRowsToRecordRows(sheet.headers, sheet.rows);

    return {
      headers: sheet.headers,
      rows: recordRows.map((values, index) => ({
        rowNumber: index + 2,
        values,
      })),
    };
  }

  const csvBuffer = buffer instanceof Buffer ? buffer : Buffer.from(buffer);
  const csvText = csvBuffer.toString("utf8").replace(/^\uFEFF/u, "");

  if (importEntityType && (isQuickBooksIifFileName(fileName) || isQuickBooksIifContent(csvText))) {
    // Same reader as the preview/validation path so chunk row numbers line up with validation.
    const table = parseQuickBooksIifToTable(
      csvBuffer.toString("utf8"),
      QUICKBOOKS_IIF_RECORD_TYPE_BY_IMPORT_ENTITY[importEntityType as keyof typeof QUICKBOOKS_IIF_RECORD_TYPE_BY_IMPORT_ENTITY],
    );
    if (!table) {
      return { headers: [], rows: [] };
    }
    return {
      headers: table.headers,
      rows: table.rows.map((values, index) => ({ rowNumber: index + 2, values })),
    };
  }
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  const headers = (result.meta.fields ?? []).map((header) => header.trim());
  const rows: TabularImportRow[] = [];

  for (let index = 0; index < result.data.length; index += 1) {
    const sourceRow = result.data[index];
    const normalizedRow: Record<string, string> = {};

    for (const header of headers) {
      const rawValue = sourceRow?.[header];
      normalizedRow[header] =
        typeof rawValue === "string" ? sanitizeSpreadsheetCell(rawValue.trim()) : "";
    }

    rows.push({
      rowNumber: index + 2,
      values: normalizedRow,
    });
  }

  return {
    headers,
    rows,
  };
}
