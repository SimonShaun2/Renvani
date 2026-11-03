const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeImportedIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (ISO_DATE_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeImportedAssetType(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.replace(/\s+/g, "_").slice(0, 100);
}

export function parseImportedBoolean(value: string | null | undefined, defaultValue = true): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["false", "0", "no", "inactive", "n"].includes(normalized)) {
    return false;
  }

  if (["true", "1", "yes", "active", "y"].includes(normalized)) {
    return true;
  }

  return defaultValue;
}

export function pickLastServiceDate(
  explicitDate: string | null,
  jobCompletedAt: Date | null | undefined,
): string | null {
  if (explicitDate) {
    return explicitDate;
  }

  if (!jobCompletedAt || Number.isNaN(jobCompletedAt.getTime())) {
    return null;
  }

  return jobCompletedAt.toISOString().slice(0, 10);
}
