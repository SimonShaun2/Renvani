import { Decimal } from "decimal.js";

import { normalizeImportText } from "./text.js";

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

function canonicalizeMoneyParts(whole: string, fraction: string): string | null {
  const normalizedFraction = fraction.padEnd(2, "0").slice(0, 2);
  const candidate =
    normalizedFraction === "00" && fraction.length === 0 ? whole : `${whole}.${normalizedFraction}`;
  return MONEY_PATTERN.test(candidate) ? candidate : null;
}

/**
 * Canonical money string for import commit (decimal dollars, up to 2 fractional digits).
 */
export function normalizeImportMoney(value: string | number | null | undefined): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    const fixed = value.toFixed(2);
    const [whole = "0", fraction = "00"] = fixed.split(".");
    return canonicalizeMoneyParts(whole, fraction);
  }

  const normalized = normalizeImportText(value);
  if (!normalized) {
    return null;
  }

  const withoutCurrency = normalized.replace(/[$,\s]/gu, "");
  if (!/^\d+(\.\d{0,2})?$/.test(withoutCurrency)) {
    return null;
  }

  const [whole = "0", fraction = ""] = withoutCurrency.split(".");
  return canonicalizeMoneyParts(whole, fraction);
}

/**
 * Parses import money into a non-negative Decimal for ledger math.
 */
export function parseImportMoney(value: string): Decimal | null {
  const trimmed = value.trim().replace(/[$,]/gu, "");
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new Decimal(trimmed);
    if (!parsed.isFinite() || parsed.isNegative()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function formatImportMoney(value: Decimal): string {
  return value.toFixed(2);
}
