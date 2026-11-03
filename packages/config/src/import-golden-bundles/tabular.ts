import {
  parseQuickBooksIifToTable,
  QUICKBOOKS_IIF_RECORD_TYPE_BY_IMPORT_ENTITY
} from "@fsm/import-engine";

import { parseCsvTable } from "./csv.js";

export function parseGoldenBundleTabularTable(
  content: string,
  relativePath: string,
  entityType?: string
): { headers: string[]; rows: string[][] } {
  if (relativePath.toLowerCase().endsWith(".iif")) {
    const preferredRecordType = entityType
      ? QUICKBOOKS_IIF_RECORD_TYPE_BY_IMPORT_ENTITY[entityType]
      : undefined;
    const parsed = parseQuickBooksIifToTable(content, preferredRecordType);
    if (!parsed) {
      return { headers: [], rows: [] };
    }

    return {
      headers: parsed.headers,
      rows: parsed.rows.map((row: Record<string, string>) =>
        parsed.headers.map((header: string) => row[header] ?? "")
      )
    };
  }

  return parseCsvTable(content);
}
