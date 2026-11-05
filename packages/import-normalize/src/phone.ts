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

/**
 * FS-281: canonical E.164 form for SMS consent matching (US default, same rules as the booking
 * command-center helper). 10 digits -> +1XXXXXXXXXX; 11 digits starting with 1 -> +1...; a leading "+"
 * keeps 8-15 digits. Anything else returns null (callers must treat null as "cannot verify" = fail closed).
 */
export function normalizePhoneE164(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/gu, "");
  if (trimmed.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
