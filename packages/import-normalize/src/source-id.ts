import { normalizeImportText } from "./text.js";

const MAX_SOURCE_ID_LENGTH = 256;

/**
 * ADR-FS-MIGRATE §1: vendor primary key as exported (trimmed), opaque string.
 */
export function normalizeImportSourceId(value: string | null | undefined): string | null {
  const trimmed = normalizeImportText(value);
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > MAX_SOURCE_ID_LENGTH) {
    return trimmed.slice(0, MAX_SOURCE_ID_LENGTH);
  }

  return trimmed;
}
