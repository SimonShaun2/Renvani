import { savedCardStripeImportRowSchema, type SavedCardStripeImportRow } from "@fsm/types";

/** Max rows per confirm-stripe-import request (confirmStripeImportBodySchema.importedPaymentMethods.max). */
export const STRIPE_IMPORT_MAX_ROWS = 200;

export type StripeImportRowError = { line: number; message: string };
export type ParsedStripeImport = { rows: SavedCardStripeImportRow[]; errors: StripeImportRowError[] };

const COLUMNS = ["stripeCustomerId", "stripePaymentMethodId", "renvaniCustomerId", "email"] as const;
const SECRET_PATTERN = /\b(sk|rk)_(test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/;

/** RFC 4180-style cell split: quoted cells may contain commas and "" escaped quotes. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === ",") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/**
 * Parses the Stripe import result CSV the owner pastes or uploads.
 * Header (any order): stripeCustomerId,stripePaymentMethodId[,renvaniCustomerId][,email].
 * Card numbers are never part of this file; Stripe holds the card data.
 */
export function parseStripeImportCsv(text: string): ParsedStripeImport {
  const errors: StripeImportRowError[] = [];
  if (SECRET_PATTERN.test(text)) {
    return { rows: [], errors: [{ line: 0, message: "Remove Stripe secret keys from the file. Only customer and payment method ids are needed." }] };
  }
  const lines = text.split(/\r?\n/).map((line, index) => ({ line: index + 1, text: line.trim() })).filter((l) => l.text.length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: "Add at least one row." }] };
  }
  const header = splitCsvLine(lines[0]!.text);
  const index = Object.fromEntries(COLUMNS.map((column) => [column, header.indexOf(column)])) as Record<(typeof COLUMNS)[number], number>;
  if (index.stripeCustomerId < 0 || index.stripePaymentMethodId < 0) {
    return { rows: [], errors: [{ line: 1, message: "Header must include stripeCustomerId and stripePaymentMethodId." }] };
  }
  const rows: SavedCardStripeImportRow[] = [];
  const seen = new Set<string>();
  for (const { line, text: raw } of lines.slice(1)) {
    const cells = splitCsvLine(raw);
    const candidate: Record<string, string> = {};
    for (const column of COLUMNS) {
      const value = index[column] >= 0 ? cells[index[column]] : undefined;
      if (value) candidate[column] = value;
    }
    const parsed = savedCardStripeImportRowSchema.safeParse(candidate);
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      errors.push({ line, message: field ? `Invalid ${String(field)}.` : "Invalid row." });
      continue;
    }
    if (seen.has(parsed.data.stripePaymentMethodId)) {
      errors.push({ line, message: "Duplicate stripePaymentMethodId." });
      continue;
    }
    seen.add(parsed.data.stripePaymentMethodId);
    rows.push(parsed.data);
  }
  if (rows.length > STRIPE_IMPORT_MAX_ROWS) {
    errors.push({ line: 0, message: `Up to ${STRIPE_IMPORT_MAX_ROWS} rows per import. Split the file and confirm each part.` });
  }
  return { rows, errors };
}
