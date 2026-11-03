import {
  mapVendorItemTypeToCategory,
  normalizeImportMoney,
  parseBooleanImportCell,
  type ImportSourceSystemId
} from "@fsm/config/import-price-book-map";
import { priceBookImportRowSchema, type PriceBookImportRow, type ValidationError } from "@fsm/types";

export interface ParsedImportRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface PriceBookValidationResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  validationErrors: ValidationError[];
}

function getMappedValue(
  values: Record<string, string>,
  columnMapping: Record<string, string | null>,
  field: string
): string | null {
  for (const [columnName, mappedField] of Object.entries(columnMapping)) {
    if (mappedField === field) {
      const raw = values[columnName];
      if (raw !== undefined) {
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
    }
  }

  return null;
}

export function mapPriceBookRow(
  values: Record<string, string>,
  columnMapping: Record<string, string | null>,
  sourceSystem: ImportSourceSystemId
): PriceBookImportRow | null {
  const sourceId =
    getMappedValue(values, columnMapping, "sourceId") ??
    getMappedValue(values, columnMapping, "sku") ??
    getMappedValue(values, columnMapping, "name");

  const name = getMappedValue(values, columnMapping, "name");
  const unitPriceRaw =
    getMappedValue(values, columnMapping, "unitPrice") ?? getMappedValue(values, columnMapping, "price");
  const unitPrice = normalizeImportMoney(unitPriceRaw) ?? "0.00";

  if (!sourceId || !name) {
    return null;
  }

  const typeRaw = getMappedValue(values, columnMapping, "type") ?? getMappedValue(values, columnMapping, "category");
  const costRaw = getMappedValue(values, columnMapping, "cost");

  return {
    sourceId,
    name,
    description: getMappedValue(values, columnMapping, "description"),
    category: mapVendorItemTypeToCategory(typeRaw, sourceSystem),
    sku: getMappedValue(values, columnMapping, "sku"),
    unitPrice,
    cost: normalizeImportMoney(costRaw),
    unit: getMappedValue(values, columnMapping, "unit") ?? "each",
    isTaxable: parseBooleanImportCell(getMappedValue(values, columnMapping, "isTaxable"), true),
    isActive: parseBooleanImportCell(getMappedValue(values, columnMapping, "isActive"), true)
  };
}

export function validatePriceBookRows(
  rows: ParsedImportRow[],
  columnMapping: Record<string, string | null>,
  sourceSystem: ImportSourceSystemId
): PriceBookValidationResult {
  const validationErrors: ValidationError[] = [];
  const seenSourceIds = new Map<string, number>();
  let duplicateRows = 0;

  for (const row of rows) {
    const mapped = mapPriceBookRow(row.values, columnMapping, sourceSystem);

    if (!mapped) {
      validationErrors.push({
        row: row.rowNumber,
        field: "name",
        message: "Name and source id (or sku) are required",
        value: getMappedValue(row.values, columnMapping, "name") ?? ""
      });
      continue;
    }

    const parsed = priceBookImportRowSchema.safeParse(mapped);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      validationErrors.push({
        row: row.rowNumber,
        field: firstIssue?.path.join(".") ?? "row",
        message: firstIssue?.message ?? "Invalid price book row",
        value: mapped.name
      });
      continue;
    }

    const priorRow = seenSourceIds.get(mapped.sourceId);
    if (priorRow !== undefined) {
      duplicateRows += 1;
      validationErrors.push({
        row: row.rowNumber,
        field: "sourceId",
        message: `Duplicate source id (also on row ${priorRow})`,
        value: mapped.sourceId
      });
      continue;
    }

    seenSourceIds.set(mapped.sourceId, row.rowNumber);
  }

  const errorRows = new Set(validationErrors.map((entry) => entry.row)).size;
  const validRows = rows.length - errorRows;

  return {
    totalRows: rows.length,
    validRows,
    errorRows,
    duplicateRows,
    validationErrors
  };
}
