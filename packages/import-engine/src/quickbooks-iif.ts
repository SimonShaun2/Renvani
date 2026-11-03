export function isQuickBooksIifFileName(fileName: string): boolean {
  return /\.iif$/iu.test(fileName.trim());
}

export function isQuickBooksIifContent(text: string): boolean {
  const sample = text.slice(0, 4096);
  return /^\s*![A-Z0-9_]+/mu.test(sample);
}

/** Primary IIF record types used when importing QBD list exports per entity slot. */
export const QUICKBOOKS_IIF_RECORD_TYPE_BY_IMPORT_ENTITY: Partial<
  Record<string, string>
> = {
  customers: "CUST",
  products: "INVITEM",
  invoices: "TRNS",
  payments: "TRNS",
  price_book: "INVITEM",
  price_book_item: "INVITEM"
};

export interface QuickBooksIifTable {
  recordType: string;
  headers: string[];
  rows: Array<Record<string, string>>;
}

function splitIifFields(line: string): string[] {
  if (line.includes("\t")) {
    return line.split("\t").map((field) => field.trim());
  }

  return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/u).map((field) => field.replace(/^"|"$/gu, "").trim());
}

export function parseQuickBooksIifToTable(
  content: string,
  preferredRecordType?: string
): QuickBooksIifTable | null {
  const schemas = new Map<string, string[]>();
  const rowsByType = new Map<string, Array<Record<string, string>>>();

  const lines = content
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    if (line.startsWith("!")) {
      const fields = splitIifFields(line.slice(1));
      const recordType = fields[0]?.toUpperCase();
      if (!recordType) {
        continue;
      }

      const headers = fields.slice(1).map((header) => header.trim());
      schemas.set(recordType, headers);
      continue;
    }

    const fields = splitIifFields(line);
    const recordType = fields[0]?.toUpperCase();
    if (!recordType) {
      continue;
    }

    const headers = schemas.get(recordType);
    if (!headers || headers.length === 0) {
      continue;
    }

    const row: Record<string, string> = {};
    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index];
      if (!header) {
        continue;
      }
      row[header] = fields[index + 1] ?? "";
    }

    const bucket = rowsByType.get(recordType) ?? [];
    bucket.push(row);
    rowsByType.set(recordType, bucket);
  }

  const recordType =
    preferredRecordType && rowsByType.has(preferredRecordType)
      ? preferredRecordType
      : [...rowsByType.keys()].find((key) => (rowsByType.get(key)?.length ?? 0) > 0);

  if (!recordType) {
    return null;
  }

  const headers = schemas.get(recordType) ?? [];
  const rows = rowsByType.get(recordType) ?? [];

  if (headers.length === 0 || rows.length === 0) {
    return null;
  }

  return { recordType, headers, rows };
}
