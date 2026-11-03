import type { ImportVendorPresetId } from "./import-vendor-presets.js";
import { importSourceSystemFromPreset, parseBooleanImportCell } from "./import-price-book-map.js";

export type ImportNoteScope = "customer" | "job";

export { importSourceSystemFromPreset };

export function resolveSourceSystemForNotesImport(
  vendorPresetId: ImportVendorPresetId | null,
): ReturnType<typeof importSourceSystemFromPreset> {
  if (!vendorPresetId) {
    return "manual_csv";
  }

  return importSourceSystemFromPreset(vendorPresetId);
}

export function parseImportedNoteVisibility(
  rawVisibility: string | null | undefined,
  rawIsInternal: string | null | undefined,
): boolean {
  if (rawIsInternal !== null && rawIsInternal !== undefined && rawIsInternal.trim().length > 0) {
    const normalized = rawIsInternal.trim().toLowerCase();
    if (["internal", "private", "staff", "office"].includes(normalized)) {
      return true;
    }
    if (["customer", "client", "public", "external"].includes(normalized)) {
      return false;
    }

    return parseBooleanImportCell(rawIsInternal, true);
  }

  if (rawVisibility) {
    const visibility = rawVisibility.trim().toLowerCase();
    if (visibility.includes("internal") || visibility.includes("private") || visibility.includes("staff")) {
      return true;
    }
    if (visibility.includes("customer") || visibility.includes("client") || visibility.includes("public")) {
      return false;
    }
  }

  return true;
}

export function resolveImportedNoteScope(
  jobSourceId: string | null,
  customerSourceId: string | null,
  rawScope: string | null | undefined,
): ImportNoteScope | null {
  if (rawScope) {
    const scope = rawScope.trim().toLowerCase();
    if (scope.includes("job") || scope.includes("work order")) {
      return "job";
    }
    if (scope.includes("customer") || scope.includes("client") || scope.includes("account")) {
      return "customer";
    }
  }

  if (jobSourceId) {
    return "job";
  }

  if (customerSourceId) {
    return "customer";
  }

  return null;
}

export function parseImportedNotedAt(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed);
}
