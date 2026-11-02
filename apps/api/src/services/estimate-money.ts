import { Decimal } from "decimal.js";

import { AppError, ErrorCode } from "@fsm/types";

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,6})(?:\.\d{1,3})?$/;
const TAX_RATE_PATTERN = /^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/;

export const MAX_MONEY = new Decimal("99999999.99");

function invalid(field: string, requirement: string): never {
  throw new AppError(ErrorCode.VALIDATION_ERROR, `${field} ${requirement}`);
}

function parseDecimalString(value: string, field: string, pattern: RegExp, requirement: string): Decimal {
  if (typeof value !== "string" || !pattern.test(value)) {
    invalid(field, requirement);
  }

  const parsed = new Decimal(value);
  if (!parsed.isFinite()) {
    invalid(field, requirement);
  }
  return parsed;
}

export function normalizeEstimateMoney(value: string, field: string): string {
  return parseDecimalString(
    value,
    field,
    MONEY_PATTERN,
    "must be a non-negative decimal string with at most 8 integer digits and 2 decimal places"
  ).toFixed(2);
}

export function normalizeEstimateQuantity(value: string, field = "quantity"): string {
  const quantity = parseDecimalString(
    value,
    field,
    QUANTITY_PATTERN,
    "must be a positive decimal string with at most 7 integer digits and 3 decimal places"
  );
  if (!quantity.greaterThan(0)) {
    invalid(field, "must be greater than zero");
  }
  return quantity.toFixed(3);
}

export function normalizeEstimateTaxRate(value: string, field = "taxRate"): string {
  return parseDecimalString(
    value,
    field,
    TAX_RATE_PATTERN,
    "must be a decimal string between 0 and 1 with at most 4 decimal places"
  ).toFixed(4);
}

export function assertEstimateMoneyResult(value: Decimal, field: string): string {
  const rounded = new Decimal(value.toFixed(2));
  if (rounded.isNegative()) {
    invalid(field, "cannot be negative");
  }
  if (rounded.greaterThan(MAX_MONEY)) {
    invalid(field, "exceeds the maximum supported amount of 99999999.99");
  }
  return rounded.toFixed(2);
}
