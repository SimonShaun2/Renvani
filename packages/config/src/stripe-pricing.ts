import { env } from "./env.js";

/** Renvani SaaS subscription tier (founder pricing 2026-10-23). */
export type RenvaniSubscriptionPlan = "flex" | "flat";

/**
 * Flex customer-paid platform fee (decimal fraction).
 * Config: STRIPE_PLATFORM_FEE_PERCENT (e.g. 0.05 = 5%). No cap. Not hard-coded in call sites.
 *
 * The fee is added **on top of** the invoice/service amount at checkout; Renvani collects it
 * as the Connect application fee. The shop receives the full invoice amount (not net of fee).
 */
export function flexConnectApplicationFeeFraction(): number {
  return env.STRIPE_PLATFORM_FEE_PERCENT;
}

export interface CustomerPaidPlatformFeeBreakdown {
  invoiceAmount: string;
  platformFeeAmount: string;
  totalDue: string;
  /** Whole-number percent when Flex fee applies (e.g. 5); null on Flat. */
  platformFeePercent: number | null;
}

function roundMoney(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

/**
 * Customer-paid platform fee on top of the service/invoice total (Flex only).
 * @deprecated Legacy STRIPE_PLATFORM_FEE_PERCENT path; customer fees use computeCheckoutFees / SERVICE_FEE_RATE_BPS. Remove in a later cleanup.
 */
export function computeCustomerPaidPlatformFee(
  invoiceAmount: string,
  fraction: number
): CustomerPaidPlatformFeeBreakdown {
  const service = Number(invoiceAmount);

  if (!Number.isFinite(service) || fraction <= 0) {
    return {
      invoiceAmount,
      platformFeeAmount: "0.00",
      totalDue: invoiceAmount,
      platformFeePercent: null
    };
  }

  const platformFeeAmount = roundMoney(service * fraction);
  const totalDue = roundMoney(service + Number(platformFeeAmount));
  const platformFeePercent = Math.round(fraction * 10000) / 100;

  return {
    invoiceAmount: roundMoney(service),
    platformFeeAmount,
    totalDue,
    platformFeePercent
  };
}

/** @deprecated Legacy "Renvani platform fee" label; use formatServiceFeeLineItemName. Remove in a later cleanup. */
export function formatCustomerPlatformFeeLineItemName(fraction: number): string {
  const percent = Math.round(fraction * 10000) / 100;
  const label = Number.isInteger(percent) ? `${percent}` : `${percent}`;
  return `Renvani platform fee (${label}%)`;
}

/** Configurable disclosure for customer payment surfaces (no hard-coded legal text in app code). */
export function customerPlatformFeeDisclosure(): string {
  return (env.CUSTOMER_PLATFORM_FEE_DISCLOSURE ?? "").trim();
}

/**
 * Connect application fee fraction for a tenant's Renvani plan.
 * Flat ($799/mo): no customer platform fee on processed payments.
 */
export function resolveConnectApplicationFeeFraction(
  plan: RenvaniSubscriptionPlan | null | undefined
): number {
  if (plan === "flex") {
    return flexConnectApplicationFeeFraction();
  }

  return 0;
}

export function resolvePlatformBillingPriceId(plan: RenvaniSubscriptionPlan): string | null {
  const flexPriceId = (env.STRIPE_PLATFORM_BILLING_PRICE_ID_FLEX ?? "").trim()
    || (env.STRIPE_PLATFORM_BILLING_PRICE_ID ?? "").trim();
  const flatPriceId = (env.STRIPE_PLATFORM_BILLING_PRICE_ID_FLAT ?? "").trim();

  if (plan === "flex") {
    return flexPriceId.length > 0 ? flexPriceId : null;
  }

  return flatPriceId.length > 0 ? flatPriceId : null;
}

export function resolveRenvaniPlanFromStripePriceId(priceId: string): RenvaniSubscriptionPlan | null {
  const normalized = priceId.trim();
  if (!normalized) {
    return null;
  }

  const flexPriceId = (env.STRIPE_PLATFORM_BILLING_PRICE_ID_FLEX ?? "").trim()
    || (env.STRIPE_PLATFORM_BILLING_PRICE_ID ?? "").trim();
  const flatPriceId = (env.STRIPE_PLATFORM_BILLING_PRICE_ID_FLAT ?? "").trim();

  if (flexPriceId && normalized === flexPriceId) {
    return "flex";
  }

  if (flatPriceId && normalized === flatPriceId) {
    return "flat";
  }

  return null;
}

// ─────────────────────────────────────────────
// Customer checkout fees (Service Fee + online-booking fee)
// ─────────────────────────────────────────────

/** Renvani plans with list prices in integer cents. Annual = 10x monthly. */
export type RenvaniPlanId = "flex" | "flat" | "founding" | "startup";

export const RENVANI_PLAN_MONTHLY_PRICE_CENTS: Readonly<Record<RenvaniPlanId, number>> = {
  flex: 39_900,
  flat: 99_900,
  founding: 19_900,
  startup: 9_900
};

export function renvaniPlanAnnualPriceCents(plan: RenvaniPlanId): number {
  return RENVANI_PLAN_MONTHLY_PRICE_CENTS[plan] * 10;
}

/** Customer-paid Service Fee rate in basis points (200 bps = 2%). Applies on Flex, Founding, Startup (not Flat). */
export const SERVICE_FEE_RATE_BPS = 200;

/** Plans whose customers pay NO Service Fee (published pricing: Flat is fee-free; booking fee still applies). */
export const SERVICE_FEE_EXEMPT_PLANS: ReadonlySet<RenvaniPlanId> = new Set<RenvaniPlanId>(["flat"]);

/**
 * Service Fee rate (bps) for a tenant's plan. Flat -> 0. Flex/Founding/Startup -> SERVICE_FEE_RATE_BPS.
 * Unknown/missing plan defaults to SERVICE_FEE_RATE_BPS (fail closed on revenue, matches pre-plan behavior).
 */
export function serviceFeeRateBpsForPlan(plan: RenvaniPlanId | null | undefined): number {
  return plan && SERVICE_FEE_EXEMPT_PLANS.has(plan) ? 0 : SERVICE_FEE_RATE_BPS;
}

/** Customer-facing Service Fee line label derived from the rate, e.g. 200 -> "Service Fee (2%)". */
export function formatServiceFeeLineItemName(rateBps: number = SERVICE_FEE_RATE_BPS): string {
  const pct = Number((rateBps / 100).toFixed(2));
  return `Service Fee (${pct}%)`;
}

/** Flat online-booking fee in cents; charged on every plan (Flat included). */
export const ONLINE_BOOKING_FEE_CENTS = 199;

/**
 * Service Fee in integer cents: chargeCents * rate, rounded half up to the nearest cent.
 * Integer math only: floor((chargeCents * bps + 5000) / 10000). e.g. 2% of $0.25 = 0.5c -> 1c.
 */
export function computeServiceFeeCents(chargeCents: number, rateBps: number = SERVICE_FEE_RATE_BPS): number {
  if (!Number.isInteger(chargeCents) || chargeCents <= 0 || rateBps <= 0) {
    return 0;
  }

  return Math.floor((chargeCents * rateBps + 5_000) / 10_000);
}

export interface CheckoutFeeBreakdown {
  /** Amount applied to the invoice (shop revenue); never includes fees. */
  chargeCents: number;
  /** 2% customer-paid Service Fee (0 on Flat), separate line, non-refundable. */
  serviceFeeCents: number;
  /** $1.99 online-booking fee; non-zero only when this checkout pays an online-booked invoice in full. */
  bookingFeeCents: number;
  /** chargeCents + serviceFeeCents + bookingFeeCents. */
  totalCents: number;
  /** Effective Service Fee rate for this checkout's plan (0 on Flat). */
  serviceFeeRateBps: number;
  /** Fees are never refunded; refunds are capped at chargeCents. */
  feeRefundable: false;
}

export interface CheckoutFeeInput {
  chargeCents: number;
  /** Invoice's job came from public online booking. */
  isOnlineBooking: boolean;
  /** This checkout settles the invoice's full remaining balance (invoice ends PAID). */
  paysInvoiceInFull: boolean;
  /** Tenant's Renvani plan. Flat pays no Service Fee; unknown/null is charged the standard rate. */
  plan?: RenvaniPlanId | null;
}

/** Fees for a customer checkout. Only call for customer checkout (not manual record-payment). */
export function computeCheckoutFees(input: CheckoutFeeInput): CheckoutFeeBreakdown {
  const chargeCents = Number.isInteger(input.chargeCents) && input.chargeCents > 0 ? input.chargeCents : 0;
  const serviceFeeRateBps = serviceFeeRateBpsForPlan(input.plan);
  const serviceFeeCents = computeServiceFeeCents(chargeCents, serviceFeeRateBps);
  const bookingFeeCents =
    chargeCents > 0 && input.isOnlineBooking && input.paysInvoiceInFull ? ONLINE_BOOKING_FEE_CENTS : 0;

  return {
    chargeCents,
    serviceFeeCents,
    bookingFeeCents,
    totalCents: chargeCents + serviceFeeCents + bookingFeeCents,
    serviceFeeRateBps,
    feeRefundable: false
  };
}

/**
 * Max refundable cents for a payment. Fees are non-refundable, so a refund can only return
 * the invoice portion (`amountCents`) less anything already refunded.
 */
export function computeRefundableCents(input: { amountCents: number; amountRefundedCents: number }): number {
  return Math.max(0, input.amountCents - Math.max(0, input.amountRefundedCents));
}

/** Converts a 2-decimal money string to integer cents, rounding half up. */
export function moneyStringToCents(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-9);
}

export function centsToMoneyString(cents: number): string {
  return (cents / 100).toFixed(2);
}
