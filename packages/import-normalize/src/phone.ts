import { normalizeImportText } from "./text.js";

/** Last-10-digit US phone normalization for dedupe and commit (FS-MIGRATE normalize pipeline). */
export function normalizeImportPhone(value: string | null | undefined): string | null {
  const normalized = normalizeImportText(value);
  if (!normalized) {
    return null;
  }

  const digits = normalized.replace(/\D/gu, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}
