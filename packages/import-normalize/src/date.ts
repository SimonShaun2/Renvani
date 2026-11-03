import { normalizeImportText } from "./text.js";

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const US_DATE_PATTERN = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/u;

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatDateOnlyUtc(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function expandTwoDigitYear(year: number): number {
  if (year >= 100) {
    return year;
  }

  return year >= 70 ? 1900 + year : 2000 + year;
}

function normalizeExcelSerialDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial >= 100_000) {
    return null;
  }

  const excelEpochUtcMs = Date.UTC(1899, 11, 30);
  const utcMs = excelEpochUtcMs + Math.round(serial) * 86_400_000;
  const parsed = new Date(utcMs);

  return formatDateOnlyUtc(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
}

/**
 * Normalizes vendor date strings to canonical `yyyy-MM-dd` (UTC calendar parts).
 */
export function normalizeImportDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const isoMatch = ISO_DATE_PATTERN.exec(trimmed);
  if (isoMatch) {
    return formatDateOnlyUtc(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  if (/^\d+(\.\d+)?$/u.test(trimmed)) {
    const serial = Number.parseFloat(trimmed);
    const fromSerial = normalizeExcelSerialDate(serial);
    if (fromSerial) {
      return fromSerial;
    }
  }

  const usMatch = US_DATE_PATTERN.exec(trimmed);
  if (usMatch) {
    const month = Number(usMatch[1]);
    const day = Number(usMatch[2]);
    const year = expandTwoDigitYear(Number(usMatch[3]));
    return formatDateOnlyUtc(year, month, day);
  }

  return null;
}

/**
 * Business date for FS-MIGRATE (YYYY-MM-DD). Does not substitute ingestion time.
 */
export function normalizeImportBusinessDate(value: string | null | undefined): string | null {
  const normalized = normalizeImportText(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return formatDateOnlyUtc(
      Number(normalized.slice(0, 4)),
      Number(normalized.slice(5, 7)),
      Number(normalized.slice(8, 10))
    );
  }

  const isoDateTime = /^(\d{4}-\d{2}-\d{2})T/.exec(normalized);
  if (isoDateTime?.[1]) {
    return normalizeImportDate(isoDateTime[1]);
  }

  return normalizeImportDate(normalized);
}
