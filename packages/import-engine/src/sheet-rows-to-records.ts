import { sanitizeSpreadsheetCell } from "@fsm/types";

/**
 * Maps header-aligned string rows to keyed records (CSV header:true equivalent).
 */
export function sheetRowsToRecordRows(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((row) => {
    const record: Record<string, string> = {};

    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index];
      if (!header) {
        continue;
      }

      const raw = row[index] ?? "";
      record[header] = sanitizeSpreadsheetCell(raw.trim());
    }

    return record;
  });
}
