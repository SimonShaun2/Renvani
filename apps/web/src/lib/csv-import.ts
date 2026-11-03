import { normalizeImportPhone } from "@fsm/import-normalize";
import Papa from "papaparse";
import type { ColumnMapping } from "@fsm/types";

import type { CustomerListRecord } from "@/src/hooks/customers.hooks";
import { sanitizeImportPreviewCell } from "@/src/lib/import-preview-sanitize";
import type {
  DuplicateMatchRecord,
  ImportPreviewRow,
  ParsedImportRow
} from "@/src/stores/csv-import.store";

export const CSV_IMPORT_FILE_SIZE_LIMIT_BYTES = 10 * 1024 * 1024;

const IMPORT_TEMPLATE_HEADERS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "addressLine1",
  "city",
  "state",
  "zip",
  "notes"
];

/** FS-11 — operator template (customers); one-way import only. */
export function downloadImportTemplateCsv(): void {
  const sampleRow = [
    "Kim",
    "Patel",
    "kim@example.com",
    "5550100",
    "101 Main St",
    "Tulsa",
    "OK",
    "74103",
    "Imported from prior system"
  ];
  downloadCsvFile(
    "renvani-customer-import-template.csv",
    [
      Object.fromEntries(
        IMPORT_TEMPLATE_HEADERS.map((header, index) => [header, sampleRow[index] ?? ""])
      )
    ]
  );
}

export const CSV_IMPORT_FIELD_OPTIONS = [
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "displayName", label: "Company Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "addressLine1", label: "Address" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "zip", label: "ZIP" },
  { value: "notes", label: "Notes" },
  { value: "__skip__", label: "Skip This Column" }
] as const;

type ImportFieldValue = (typeof CSV_IMPORT_FIELD_OPTIONS)[number]["value"];

export interface ParsedImportFile {
  uploadFile: File;
  headers: string[];
  rows: ParsedImportRow[];
  sampleRows: ParsedImportRow[];
  fileName: string;
}

function normalizeTextValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeEmailValue(value: string | null | undefined): string | null {
  const normalizedValue = normalizeTextValue(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
}

function normalizeNameValue(value: string | null | undefined): string | null {
  const normalizedValue = normalizeTextValue(value);
  return normalizedValue ? normalizedValue.toLowerCase() : null;
}

function parseCsvText(csvText: string): ParsedImportRow[] {
  const result = Papa.parse<Record<string, string>>(csvText.replace(/^\uFEFF/u, ""), {
    header: true,
    skipEmptyLines: true
  });
  const headers = (result.meta.fields ?? []).map((header) => header.trim());

  return result.data.map((sourceRow, index) => {
    const values: Record<string, string> = {};

    for (const header of headers) {
      const rawValue = sourceRow?.[header];
      values[header] =
        typeof rawValue === "string" ? sanitizeImportPreviewCell(rawValue.trim()) : "";
    }

    return {
      rowNumber: index + 2,
      values
    };
  });
}

async function convertXlsxToCsv(file: File): Promise<string> {
  const workbookModule = await import("xlsx");
  const arrayBuffer = await file.arrayBuffer();
  const workbook = workbookModule.read(arrayBuffer, {
    type: "array"
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("The spreadsheet does not contain any sheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error("The first spreadsheet tab could not be read.");
  }

  return workbookModule.utils.sheet_to_csv(sheet, {
    blankrows: false
  });
}

export function getImportFieldLabel(value: string | null | undefined) {
  if (!value || value === "__skip__") {
    return "Skipped";
  }

  return CSV_IMPORT_FIELD_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function hasRequiredMappings(mappings: ColumnMapping) {
  const selectedFields = new Set(
    Object.values(mappings).filter((value): value is string => typeof value === "string" && value !== "__skip__")
  );

  const hasNamePair = selectedFields.has("firstName") && selectedFields.has("lastName");
  const hasCompanyName = selectedFields.has("displayName");
  return hasNamePair || hasCompanyName;
}

export function getMissingMappingMessage(mappings: ColumnMapping) {
  if (hasRequiredMappings(mappings)) {
    return null;
  }

  return "Map either First Name + Last Name, or Company Name, before continuing.";
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  if (file.size > CSV_IMPORT_FILE_SIZE_LIMIT_BYTES) {
    throw new Error("Files must be 10MB or smaller.");
  }

  const lowerName = file.name.toLowerCase();
  const csvText =
    lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")
      ? await convertXlsxToCsv(file)
      : await file.text();
  const rows = parseCsvText(csvText);

  if (rows.length === 0) {
    throw new Error("The selected file did not contain any rows to import.");
  }

  const headers = Object.keys(rows[0]?.values ?? {});
  if (headers.length === 0) {
    throw new Error("The selected file did not contain recognizable column headers.");
  }

  const baseName = file.name.replace(/\.(csv|xlsx|xls)$/iu, "");
  const uploadFile = new File([csvText], `${baseName || "import"}.csv`, {
    type: "text/csv"
  });

  return {
    uploadFile,
    headers,
    rows,
    sampleRows: rows.slice(0, 5),
    fileName: file.name
  };
}

export function buildInitialMappings(headers: string[], serverMappings: ColumnMapping): ColumnMapping {
  return Object.fromEntries(
    headers.map((header) => [header, serverMappings[header] ?? null])
  );
}

export function mergeServerMappings(
  headers: string[],
  currentMappings: ColumnMapping,
  serverMappings: ColumnMapping
): ColumnMapping {
  return Object.fromEntries(
    headers.map((header) => [
      header,
      currentMappings[header] ?? serverMappings[header] ?? null
    ])
  );
}

export function getSampleValueForHeader(header: string, sampleRows: ParsedImportRow[]) {
  const raw =
    sampleRows.find((row) => normalizeTextValue(row.values[header]) !== null)?.values[header] ?? "Empty";
  return raw === "Empty" ? raw : sanitizeImportPreviewCell(raw);
}

export function buildPreviewRows(rows: ParsedImportRow[], mappings: ColumnMapping): ImportPreviewRow[] {
  const activeMappings = Object.entries(mappings).filter(
    ([, fieldName]) => typeof fieldName === "string" && fieldName.length > 0 && fieldName !== "__skip__"
  );

  return rows.slice(0, 5).map((row) => ({
    rowNumber: row.rowNumber,
    mappedValues: Object.fromEntries(
      activeMappings.map(([header, fieldName]) => [
        getImportFieldLabel(fieldName),
        sanitizeImportPreviewCell(row.values[header] ?? "")
      ])
    )
  }));
}

function getMappedRowFieldValue(row: ParsedImportRow, mappings: ColumnMapping, targetField: ImportFieldValue) {
  for (const [columnName, fieldName] of Object.entries(mappings)) {
    if (fieldName === targetField) {
      return row.values[columnName] ?? "";
    }
  }

  return "";
}

function getMappedRowName(row: ParsedImportRow, mappings: ColumnMapping) {
  const displayName = normalizeTextValue(getMappedRowFieldValue(row, mappings, "displayName"));
  if (displayName) {
    return displayName;
  }

  const firstName = normalizeTextValue(getMappedRowFieldValue(row, mappings, "firstName")) ?? "";
  const lastName = normalizeTextValue(getMappedRowFieldValue(row, mappings, "lastName")) ?? "";
  return `${firstName} ${lastName}`.trim();
}

export function buildDuplicateMatches(
  rows: ParsedImportRow[],
  mappings: ColumnMapping,
  customers: CustomerListRecord[]
): DuplicateMatchRecord[] {
  const matches: DuplicateMatchRecord[] = [];

  for (const row of rows) {
    const email = normalizeEmailValue(getMappedRowFieldValue(row, mappings, "email"));
    const phone = normalizeImportPhone(getMappedRowFieldValue(row, mappings, "phone"));
    const mappedName = getMappedRowName(row, mappings);
    const normalizedName = normalizeNameValue(mappedName);

    const emailMatch = email
      ? customers.find((customer) => normalizeEmailValue(customer.email) === email)
      : undefined;
    if (emailMatch) {
      matches.push({
        rowNumber: row.rowNumber,
        rowLabel: mappedName || `Row ${row.rowNumber}`,
        sourceValues: row.values,
        matchedCustomerId: emailMatch.id,
        matchedCustomerName:
          emailMatch.displayName ?? `${emailMatch.firstName} ${emailMatch.lastName}`.trim(),
        matchedCustomerEmail: emailMatch.email,
        matchedCustomerPhone: emailMatch.phone,
        matchReason: "email",
        action: "skip"
      });
      continue;
    }

    const phoneMatch = phone
      ? customers.find((customer) => normalizeImportPhone(customer.phone) === phone)
      : undefined;
    if (phoneMatch) {
      matches.push({
        rowNumber: row.rowNumber,
        rowLabel: mappedName || `Row ${row.rowNumber}`,
        sourceValues: row.values,
        matchedCustomerId: phoneMatch.id,
        matchedCustomerName:
          phoneMatch.displayName ?? `${phoneMatch.firstName} ${phoneMatch.lastName}`.trim(),
        matchedCustomerEmail: phoneMatch.email,
        matchedCustomerPhone: phoneMatch.phone,
        matchReason: "phone",
        action: "skip"
      });
      continue;
    }

    const nameMatch = normalizedName
      ? customers.find((customer) => {
          const customerName = customer.displayName ?? `${customer.firstName} ${customer.lastName}`.trim();
          return normalizeNameValue(customerName) === normalizedName;
        })
      : undefined;

    if (!nameMatch) {
      continue;
    }

    matches.push({
      rowNumber: row.rowNumber,
      rowLabel: mappedName || `Row ${row.rowNumber}`,
      sourceValues: row.values,
      matchedCustomerId: nameMatch.id,
      matchedCustomerName:
        nameMatch.displayName ?? `${nameMatch.firstName} ${nameMatch.lastName}`.trim(),
      matchedCustomerEmail: nameMatch.email,
      matchedCustomerPhone: nameMatch.phone,
      matchReason: "name",
      action: "skip"
    });
  }

  return matches;
}

export function downloadCsvFile(filename: string, rows: Record<string, string | number | null>[]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function coerceColumnMappingForApi(mappings: ColumnMapping): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(mappings).map(([header, fieldName]) => [
      header,
      typeof fieldName === "string" && fieldName !== "__skip__" ? fieldName : null
    ])
  );
}

export function buildDuplicateActionsPayload(matches: DuplicateMatchRecord[]) {
  return Object.fromEntries(matches.map((match) => [String(match.rowNumber), match.action]));
}

export function buildEstimatedTimeRemaining(
  startedAt: string | null,
  processedRows: number,
  totalRows: number
) {
  if (!startedAt || processedRows <= 0 || totalRows <= 0 || processedRows >= totalRows) {
    return null;
  }

  const startedAtMs = new Date(startedAt).getTime();
  if (Number.isNaN(startedAtMs)) {
    return null;
  }

  const elapsedMs = Date.now() - startedAtMs;
  const remainingMs = (elapsedMs / processedRows) * (totalRows - processedRows);

  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }

  const remainingMinutes = Math.ceil(remainingMs / 60000);
  return remainingMinutes <= 1 ? "Less than a minute remaining" : `About ${remainingMinutes} minutes remaining`;
}

export function toProgressPercent(processedRows: number, totalRows: number) {
  if (totalRows <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((processedRows / totalRows) * 100)));
}

export function coerceImportResults(input: {
  status: "completed" | "failed";
  importedRows: number | null;
  skippedRows: number | null;
  errorRows: number | null;
  duplicateRows: number | null;
  totalRows: number | null;
  completedAt: string | null;
  errorMessage: string | null;
}) {
  return {
    status: input.status,
    importedRows: input.importedRows ?? 0,
    skippedRows: input.skippedRows ?? 0,
    errorRows: input.errorRows ?? 0,
    duplicateRows: input.duplicateRows ?? 0,
    totalRows: input.totalRows ?? 0,
    completedAt: input.completedAt,
    errorMessage: input.errorMessage
  } as const;
}
