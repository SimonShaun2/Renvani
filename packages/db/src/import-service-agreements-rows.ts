import {
  normalizeImportedIsoDate,
  normalizeImportedMaintenancePlanFrequency,
  normalizeImportedMaintenancePlanStatus,
  parseImportedMaintenancePlanPrice,
} from "@fsm/config/import-service-agreements-map";
import {
  serviceAgreementImportRowSchema,
  type ServiceAgreementImportRow,
  type ValidationError,
} from "@fsm/types";

export interface ParsedImportRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ServiceAgreementsValidationResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  validationErrors: ValidationError[];
}

function getMappedValue(
  values: Record<string, string>,
  columnMapping: Record<string, string | null>,
  field: string,
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

export function mapServiceAgreementImportRow(
  values: Record<string, string>,
  columnMapping: Record<string, string | null>,
): ServiceAgreementImportRow | null {
  const sourceId = getMappedValue(values, columnMapping, "sourceId");
  const name = getMappedValue(values, columnMapping, "name");
  const customerSourceId = getMappedValue(values, columnMapping, "customerSourceId");
  const nextServiceDate = normalizeImportedIsoDate(getMappedValue(values, columnMapping, "nextServiceDate"));
  const startDate =
    normalizeImportedIsoDate(getMappedValue(values, columnMapping, "startDate")) ?? nextServiceDate;

  if (!sourceId || !name || !customerSourceId || !nextServiceDate || !startDate) {
    return null;
  }

  return {
    sourceId,
    name,
    customerSourceId,
    nextServiceDate,
    startDate,
    frequency: normalizeImportedMaintenancePlanFrequency(getMappedValue(values, columnMapping, "frequency")),
    status: normalizeImportedMaintenancePlanStatus(getMappedValue(values, columnMapping, "status")),
    price: parseImportedMaintenancePlanPrice(getMappedValue(values, columnMapping, "price")),
  };
}

export function validateServiceAgreementImportRows(
  rows: ParsedImportRow[],
  columnMapping: Record<string, string | null>,
): ServiceAgreementsValidationResult {
  const validationErrors: ValidationError[] = [];
  const seenSourceIds = new Map<string, number>();
  let duplicateRows = 0;

  for (const row of rows) {
    const mapped = mapServiceAgreementImportRow(row.values, columnMapping);

    if (!mapped) {
      validationErrors.push({
        row: row.rowNumber,
        field: "name",
        message: "Agreement id, plan name, customer reference, and next service date are required",
        value: getMappedValue(row.values, columnMapping, "name") ?? "",
      });
      continue;
    }

    const parsed = serviceAgreementImportRowSchema.safeParse(mapped);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      validationErrors.push({
        row: row.rowNumber,
        field: firstIssue?.path.join(".") ?? "name",
        message: firstIssue?.message ?? "Invalid service agreement row",
        value: mapped.name.slice(0, 120),
      });
      continue;
    }

    const priorRow = seenSourceIds.get(parsed.data.sourceId);
    if (priorRow !== undefined) {
      duplicateRows += 1;
      validationErrors.push({
        row: row.rowNumber,
        field: "sourceId",
        message: `Duplicate agreement id (also on row ${priorRow})`,
        value: parsed.data.sourceId,
      });
      continue;
    }

    seenSourceIds.set(parsed.data.sourceId, row.rowNumber);
  }

  const errorRows = validationErrors.length;
  const validRows = rows.length - errorRows;

  return {
    totalRows: rows.length,
    validRows,
    errorRows,
    duplicateRows,
    validationErrors,
  };
}
