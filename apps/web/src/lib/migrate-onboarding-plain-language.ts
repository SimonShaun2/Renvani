import type { ImportErrorRecord } from "@/src/hooks/imports.hooks";

export interface PlainLanguageImportIssue {
  id: string;
  row: number;
  headline: string;
  detail: string;
  field: string;
}

const FIELD_LABELS: Record<string, string> = {
  email: "email address",
  phone: "phone number",
  firstName: "first name",
  lastName: "last name",
  address: "street address",
  city: "city",
  state: "state",
  zip: "ZIP code"
};

function labelForField(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

export function toPlainLanguageImportIssue(error: ImportErrorRecord): PlainLanguageImportIssue {
  const fieldLabel = labelForField(error.field);
  const headline = `Row ${error.row}: fix the ${fieldLabel}`;
  const detail =
    error.message.length > 0
      ? `${error.message}${error.value ? ` (value: "${error.value}")` : ""}`
      : `This row has a problem with ${fieldLabel}.`;

  return {
    id: `${error.row}-${error.field}`,
    row: error.row,
    headline,
    detail,
    field: error.field
  };
}

export function summarizeImportIssues(errors: ImportErrorRecord[]): string {
  if (errors.length === 0) {
    return "No validation issues found. You can continue when mappings look correct.";
  }

  if (errors.length === 1) {
    return "We found 1 row that needs a quick fix before import.";
  }

  return `We found ${errors.length} rows with validation issues. Fix or skip them before you commit.`;
}
