import {
  parseImportedNotedAt,
  parseImportedNoteVisibility,
  resolveImportedNoteScope,
} from "@fsm/config/import-notes-map";
import { noteImportRowSchema, type NoteImportRow, type ValidationError } from "@fsm/types";

export interface ParsedImportRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface NotesValidationResult {
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

export function mapNoteImportRow(
  values: Record<string, string>,
  columnMapping: Record<string, string | null>,
): NoteImportRow | null {
  const sourceId = getMappedValue(values, columnMapping, "sourceId");
  const content = getMappedValue(values, columnMapping, "content");
  const customerSourceId = getMappedValue(values, columnMapping, "customerSourceId");
  const jobSourceId = getMappedValue(values, columnMapping, "jobSourceId");
  const scope = resolveImportedNoteScope(
    jobSourceId,
    customerSourceId,
    getMappedValue(values, columnMapping, "scope"),
  );

  if (!sourceId || !content || !scope) {
    return null;
  }

  const isInternal = parseImportedNoteVisibility(
    getMappedValue(values, columnMapping, "visibility"),
    getMappedValue(values, columnMapping, "isInternal"),
  );

  const notedAt = parseImportedNotedAt(getMappedValue(values, columnMapping, "notedAt"));

  const row: NoteImportRow = {
    sourceId,
    scope,
    content,
    isInternal,
    notedAt,
  };

  if (scope === "customer" && customerSourceId) {
    row.customerSourceId = customerSourceId;
  }

  if (scope === "job" && jobSourceId) {
    row.jobSourceId = jobSourceId;
  }

  return row;
}

export function validateNoteImportRows(
  rows: ParsedImportRow[],
  columnMapping: Record<string, string | null>,
): NotesValidationResult {
  const validationErrors: ValidationError[] = [];
  const seenSourceIds = new Map<string, number>();
  let duplicateRows = 0;

  for (const row of rows) {
    const mapped = mapNoteImportRow(row.values, columnMapping);

    if (!mapped) {
      validationErrors.push({
        row: row.rowNumber,
        field: "content",
        message: "Note id, content, and parent customer/job reference are required",
        value: getMappedValue(row.values, columnMapping, "content") ?? "",
      });
      continue;
    }

    const parsed = noteImportRowSchema.safeParse(mapped);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      validationErrors.push({
        row: row.rowNumber,
        field: firstIssue?.path.join(".") ?? "content",
        message: firstIssue?.message ?? "Invalid note row",
        value: mapped.content.slice(0, 120),
      });
      continue;
    }

    const priorRow = seenSourceIds.get(parsed.data.sourceId);
    if (priorRow !== undefined) {
      duplicateRows += 1;
      validationErrors.push({
        row: row.rowNumber,
        field: "sourceId",
        message: `Duplicate note id (also on row ${priorRow})`,
        value: parsed.data.sourceId,
      });
      continue;
    }

    seenSourceIds.set(parsed.data.sourceId, row.rowNumber);
  }

  const errorRows = new Set(validationErrors.map((entry) => entry.row)).size;

  return {
    totalRows: rows.length,
    validRows: rows.length - errorRows,
    errorRows,
    duplicateRows,
    validationErrors,
  };
}

