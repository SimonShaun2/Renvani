import type { customers } from "@fsm/db";
import { normalizeImportPhone } from "@fsm/import-normalize";
import { sanitizeSpreadsheetCell, type ColumnMapping, type ValidationError } from "@fsm/types";

/**
 * Customer row mapping, validation and email/phone/name duplicate matching shared by the
 * one-shot `execute-import` path and the `customers` import-chunk committer.
 */

export type CustomerRow = typeof customers.$inferSelect;

export interface ParsedCsvRow {
  rowNumber: number;
  values: Record<string, string>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface CustomerImportRow {
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  tags: string[];
}

export interface ValidationResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  validationErrors: ValidationError[];
}

export type DuplicateAction = "skip" | "update_existing" | "import_new";

export interface CustomerDuplicateMatch {
  customer: CustomerRow;
  reason: "email" | "phone" | "name";
}

export function normalizeDuplicateActions(value: unknown): Record<string, DuplicateAction> {
  if (!isPlainObject(value)) {
    return {};
  }

  const duplicateActions: Record<string, DuplicateAction> = {};

  for (const [key, action] of Object.entries(value)) {
    if (action === "skip" || action === "update_existing" || action === "import_new") {
      duplicateActions[key] = action;
    }
  }

  return duplicateActions;
}

export function normalizeTextValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = sanitizeSpreadsheetCell(value.trim());
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function normalizeEmailValue(value: string | null | undefined): string | null {
  const normalizedValue = normalizeTextValue(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
}

export function normalizeCustomerNameValue(value: string | null | undefined): string | null {
  const normalizedValue = normalizeTextValue(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

export function getMappedCustomerName(mappedRow: CustomerImportRow): string | null {
  if (mappedRow.displayName) {
    return mappedRow.displayName;
  }

  const fullName = `${mappedRow.firstName} ${mappedRow.lastName}`.trim();
  return fullName.length > 0 ? fullName : null;
}

export function buildCustomerLookupMaps(existingCustomers: CustomerRow[]) {
  const emailMap = new Map<string, CustomerRow>();
  const phoneMap = new Map<string, CustomerRow>();
  const nameMap = new Map<string, CustomerRow>();

  for (const customer of existingCustomers) {
    const normalizedEmail = normalizeEmailValue(customer.email);
    const normalizedPhone = normalizeImportPhone(customer.phone);
    const normalizedName = normalizeCustomerNameValue(
      customer.displayName ?? `${customer.firstName} ${customer.lastName}`.trim()
    );

    if (normalizedEmail && !emailMap.has(normalizedEmail)) {
      emailMap.set(normalizedEmail, customer);
    }

    if (normalizedPhone && !phoneMap.has(normalizedPhone)) {
      phoneMap.set(normalizedPhone, customer);
    }

    if (normalizedName && !nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, customer);
    }
  }

  return {
    emailMap,
    phoneMap,
    nameMap
  };
}

export function findDuplicateCustomer(
  mappedRow: CustomerImportRow,
  existingCustomers: ReturnType<typeof buildCustomerLookupMaps>
): CustomerDuplicateMatch | null {
  const normalizedEmail = normalizeEmailValue(mappedRow.email);
  if (normalizedEmail) {
    const customer = existingCustomers.emailMap.get(normalizedEmail);
    if (customer) {
      return { customer, reason: "email" };
    }
  }

  const normalizedPhone = normalizeImportPhone(mappedRow.phone);
  if (normalizedPhone) {
    const customer = existingCustomers.phoneMap.get(normalizedPhone);
    if (customer) {
      return { customer, reason: "phone" };
    }
  }

  const normalizedName = normalizeCustomerNameValue(getMappedCustomerName(mappedRow));
  if (normalizedName) {
    const customer = existingCustomers.nameMap.get(normalizedName);
    if (customer) {
      return { customer, reason: "name" };
    }
  }

  return null;
}

export function buildCustomerUpdateValues(
  existingCustomer: CustomerRow,
  mappedRow: CustomerImportRow,
  importSessionId: string,
  now: Date
) {
  const mergedTags = Array.from(
    new Set([...(existingCustomer.tags ?? []), ...mappedRow.tags])
  );
  const mergedNotes = mappedRow.notes
    ? existingCustomer.internalNotes
      ? existingCustomer.internalNotes.includes(mappedRow.notes)
        ? existingCustomer.internalNotes
        : `${existingCustomer.internalNotes}\n${mappedRow.notes}`
      : mappedRow.notes
    : existingCustomer.internalNotes;

  return {
    ...(existingCustomer.firstName.trim().length === 0 && mappedRow.firstName.length > 0
      ? { firstName: mappedRow.firstName }
      : {}),
    ...(existingCustomer.lastName.trim().length === 0 && mappedRow.lastName.length > 0
      ? { lastName: mappedRow.lastName }
      : {}),
    ...(existingCustomer.displayName === null && mappedRow.displayName
      ? { displayName: mappedRow.displayName }
      : {}),
    ...(existingCustomer.email === null && mappedRow.email
      ? { email: mappedRow.email }
      : {}),
    ...(existingCustomer.phone === null && mappedRow.phone
      ? { phone: mappedRow.phone }
      : {}),
    ...(existingCustomer.altPhone === null && mappedRow.altPhone
      ? { altPhone: mappedRow.altPhone }
      : {}),
    tags: mergedTags,
    internalNotes: mergedNotes,
    importSessionId,
    updatedAt: now
  };
}

export function mapCustomerRow(values: Record<string, string>, columnMapping: ColumnMapping): CustomerImportRow {
  const mappedValues: Record<string, string> = {};

  for (const [csvColumn, fieldName] of Object.entries(columnMapping)) {
    if (typeof fieldName !== "string" || fieldName.length === 0) {
      continue;
    }

    mappedValues[fieldName] = values[csvColumn] ?? "";
  }

  const firstName = normalizeTextValue(mappedValues.firstName);
  const lastName = normalizeTextValue(mappedValues.lastName);
  const displayName = normalizeTextValue(mappedValues.displayName);

  return {
    firstName: firstName ?? (displayName ?? ""),
    lastName: lastName ?? "",
    displayName,
    email: normalizeEmailValue(mappedValues.email),
    phone: normalizeTextValue(mappedValues.phone),
    altPhone: normalizeTextValue(mappedValues.altPhone),
    addressLine1: normalizeTextValue(mappedValues.addressLine1),
    city: normalizeTextValue(mappedValues.city),
    state: normalizeTextValue(mappedValues.state),
    zip: normalizeTextValue(mappedValues.zip),
    notes: normalizeTextValue(mappedValues.notes),
    tags: normalizeTextValue(mappedValues.tags)
      ?.split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0) ?? []
  };
}

export function validateCustomerRows(rows: ParsedCsvRow[], columnMapping: ColumnMapping, existingCustomers: CustomerRow[]): ValidationResult {
  const validationErrors: ValidationError[] = [];
  const rowErrors = new Set<number>();
  let duplicateRows = 0;
  const customerLookupMaps = buildCustomerLookupMaps(existingCustomers);

  for (const row of rows) {
    const mappedRow = mapCustomerRow(row.values, columnMapping);
    const hasDisplayName = mappedRow.displayName !== null;
    const hasFirstAndLastName = mappedRow.firstName.length > 0 && mappedRow.lastName.length > 0;

    if (!hasDisplayName && !hasFirstAndLastName) {
      validationErrors.push({
        row: row.rowNumber,
        field: "firstName",
        message: "Required field missing",
        value: mappedRow.firstName
      });
      rowErrors.add(row.rowNumber);
    }

    if (mappedRow.email && !isValidEmail(mappedRow.email)) {
      validationErrors.push({
        row: row.rowNumber,
        field: "email",
        message: "Invalid email format",
        value: mappedRow.email
      });
      rowErrors.add(row.rowNumber);
    }

    if (rowErrors.has(row.rowNumber)) {
      continue;
    }

    if (findDuplicateCustomer(mappedRow, customerLookupMaps)) {
      duplicateRows += 1;
    }
  }

  return {
    totalRows: rows.length,
    validRows: rows.length - rowErrors.size - duplicateRows,
    errorRows: rowErrors.size,
    duplicateRows,
    validationErrors
  };
}

// --- per-entity validation for chunk-committed types -------------------------------------

function mappedValues(values: Record<string, string>, columnMapping: ColumnMapping): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [column, fieldName] of Object.entries(columnMapping)) {
    if (typeof fieldName === "string" && fieldName.length > 0) {
      mapped[fieldName] = values[column] ?? "";
    }
  }
  return mapped;
}

function validateRequiredFields(
  rows: ParsedCsvRow[],
  columnMapping: ColumnMapping,
  required: ReadonlyArray<ReadonlyArray<string>>,
): ValidationResult {
  const validationErrors: ValidationError[] = [];
  const rowErrors = new Set<number>();

  for (const row of rows) {
    const mapped = mappedValues(row.values, columnMapping);
    for (const alternatives of required) {
      if (!alternatives.some((field) => normalizeTextValue(mapped[field]))) {
        validationErrors.push({
          row: row.rowNumber,
          field: alternatives[0] ?? "unknown",
          message: "Required field missing",
          value: "",
        });
        rowErrors.add(row.rowNumber);
      }
    }
  }

  return {
    totalRows: rows.length,
    validRows: rows.length - rowErrors.size,
    errorRows: rowErrors.size,
    duplicateRows: 0,
    validationErrors,
  };
}

export function validatePropertyImportRows(rows: ParsedCsvRow[], columnMapping: ColumnMapping): ValidationResult {
  return validateRequiredFields(rows, columnMapping, [
    ["sourceId", "propertySourceId", "locationSourceId"],
    ["customerSourceId", "customerId"],
    ["addressLine1", "address", "street"],
    ["city"],
    ["state"],
    ["zip", "postalCode"],
  ]);
}

export function validateInvoiceImportRows(rows: ParsedCsvRow[], columnMapping: ColumnMapping): ValidationResult {
  return validateRequiredFields(rows, columnMapping, [
    ["sourceId", "invoiceNumber"],
    ["customerSourceId", "customerId"],
    ["total"],
  ]);
}

/** Row checks for entity types whose committer validates per row (jobs, estimates, assets). */
export function countRowsWithoutValidation(rows: ParsedCsvRow[]): ValidationResult {
  return { totalRows: rows.length, validRows: rows.length, errorRows: 0, duplicateRows: 0, validationErrors: [] };
}

export const UNSUPPORTED_IMPORT_ENTITY_MESSAGE = (entityType: string) =>
  `UNSUPPORTED_ENTITY_TYPE: importing "${entityType}" is not supported yet; no rows were committed.`;

/** Marks every row as an error so the preview shows the type is not importable yet. */
export function validateUnsupportedEntityRows(rows: ParsedCsvRow[], entityType: string): ValidationResult {
  const message = UNSUPPORTED_IMPORT_ENTITY_MESSAGE(entityType);
  return {
    totalRows: rows.length,
    validRows: 0,
    errorRows: rows.length,
    duplicateRows: 0,
    validationErrors: rows.slice(0, 1).map((row) => ({ row: row.rowNumber, field: "entityType", message, value: entityType })),
  };
}

export function normalizeValidationErrorRowNumbers(value: unknown): Set<number> {
  const rows = new Set<number>();
  if (!Array.isArray(value)) {
    return rows;
  }
  for (const entry of value) {
    if (isPlainObject(entry) && typeof entry.row === "number") {
      rows.add(entry.row);
    }
  }
  return rows;
}
