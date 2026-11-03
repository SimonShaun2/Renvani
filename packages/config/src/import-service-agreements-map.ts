import type { MaintenancePlanFrequency, MaintenancePlanStatus } from "@fsm/types";

import type { ImportVendorPresetId } from "./import-vendor-presets.js";
import { importSourceSystemFromPreset, parseBooleanImportCell } from "./import-price-book-map.js";

export { importSourceSystemFromPreset };

export function resolveSourceSystemForServiceAgreementsImport(
  vendorPresetId: ImportVendorPresetId | null,
): ReturnType<typeof importSourceSystemFromPreset> {
  if (!vendorPresetId) {
    return "manual_csv";
  }

  return importSourceSystemFromPreset(vendorPresetId);
}

export function normalizeImportedIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

const FREQUENCY_ALIASES: Record<string, MaintenancePlanFrequency> = {
  monthly: "monthly",
  month: "monthly",
  "bi-monthly": "bi_monthly",
  bimonthly: "bi_monthly",
  quarterly: "quarterly",
  quarter: "quarterly",
  "bi-annual": "bi_annual",
  biannual: "bi_annual",
  semiannual: "bi_annual",
  "semi-annual": "bi_annual",
  annual: "annual",
  yearly: "annual",
  year: "annual",
};

export function normalizeImportedMaintenancePlanFrequency(
  raw: string | null | undefined,
): MaintenancePlanFrequency {
  if (!raw) {
    return "annual";
  }

  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return FREQUENCY_ALIASES[key] ?? FREQUENCY_ALIASES[key.replace(/_/g, "-")] ?? "annual";
}

export function normalizeImportedMaintenancePlanStatus(
  raw: string | null | undefined,
): MaintenancePlanStatus {
  if (!raw) {
    return "active";
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized.includes("cancel")) {
    return "cancelled";
  }
  if (normalized.includes("pause") || normalized.includes("hold")) {
    return "paused";
  }
  if (normalized.includes("expire") || normalized.includes("ended")) {
    return "expired";
  }
  if (normalized.includes("inactive") && parseBooleanImportCell(raw, true) === false) {
    return "cancelled";
  }

  return "active";
}

export function parseImportedMaintenancePlanPrice(
  raw: string | null | undefined,
): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim().replace(/[$,]/g, "");
  if (trimmed.length === 0) {
    return null;
  }

  const match = trimmed.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    return null;
  }

  const dollars = match[1];
  const cents = match[2] ?? "00";
  return `${dollars}.${cents.padEnd(2, "0").slice(0, 2)}`;
}
