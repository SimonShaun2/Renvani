import { SERVICE_FEE_RATE_BPS, formatServiceFeeLineItemName } from "@fsm/config/stripe-pricing";

/**
 * Single source for customer/operator "Service Fee" copy (Figma 53:3–53:465, 60:184/60:543, 52:16).
 * Rules: only "Service Fee", 2% on Flex, charged at checkout, no fee line on Flat, no booking fee.
 */
export const SERVICE_FEE_NAME = "Service Fee";

/** Percent (e.g. 2) -> bps; falls back to the shared config rate. */
export function serviceFeeBps(percent?: number | null): number {
  return typeof percent === "number" && percent > 0 ? Math.round(percent * 100) : SERVICE_FEE_RATE_BPS;
}

/** "2%" */
export function serviceFeePercentLabel(percent?: number | null): string {
  return pct(percent);
}

function pct(percent?: number | null): string {
  return `${Number((serviceFeeBps(percent) / 100).toFixed(2))}%`;
}

/** Line / column label: "Service Fee (2%)" (53:36, 52:227). */
export function serviceFeeLineLabel(percent?: number | null): string {
  return formatServiceFeeLineItemName(serviceFeeBps(percent));
}

/** Operator label: "Service Fee (2%) · paid by customer at checkout". */
export function serviceFeeCheckoutLabel(percent?: number | null): string {
  return `${serviceFeeLineLabel(percent)} · paid by customer at checkout`;
}

/** Customer note under the summary (53:38, 60:543). */
export function serviceFeeNote(percent?: number | null): string {
  return `A ${pct(percent)} ${SERVICE_FEE_NAME} applies to payments made online through Renvani.`;
}

export const SETTINGS_FEE_COPY = {
  heading: SERVICE_FEE_NAME,
  flexHint: "Paid by your customer at checkout. You receive the full invoice amount.",
  flatValue: "None",
  flatHint: `Flat plan: no ${SERVICE_FEE_NAME}. Your customers pay the invoice amount only.`,
  unsetValue: "Not set",
  unsetHint: `No billing plan set yet. Your ${SERVICE_FEE_NAME} will show here once a plan is chosen.`
} as const;

/** Payments dashboard note (Flex only). */
export function payoutFeeNote(percent: number): string {
  return `On Flex, the ${pct(percent)} ${SERVICE_FEE_NAME} is paid by your customer and isn't taken from your payout.`;
}

/** Legacy receipts only: shows a booking fee that was actually charged before it was removed. */
export const LEGACY_BOOKING_FEE_LABEL = "Online booking fee";
