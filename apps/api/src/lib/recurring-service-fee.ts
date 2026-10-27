import {
  centsToMoneyString,
  computeCheckoutFees,
  formatServiceFeeLineItemName,
  moneyStringToCents
} from "@fsm/config/stripe-pricing";
import { readRenvaniSubscriptionPlan } from "./company-renvani-plan.js";

type CompanySettingsCarrier = { settings: unknown };

export interface RecurringServiceFee {
  /** Shop's recurring price in cents (shop revenue; never includes the fee). */
  chargeCents: number;
  /** Customer-paid Service Fee in cents (0 on Flat -> no fee line is sent to Stripe). */
  serviceFeeCents: number;
  serviceFeeRateBps: number;
  /** "Service Fee (2%)" — derived from the rate. */
  lineItemName: string;
  /** Fee as a 2-decimal money string for the recurring Stripe price. */
  serviceFeeAmount: string;
  /**
   * Connect application_fee_percent so Renvani keeps the Service Fee line and the shop keeps its
   * full price: fee / (price + fee) * 100, rounded to Stripe's 2-decimal precision. null when no fee.
   */
  applicationFeePercent: number | null;
}

/**
 * Service Fee for service-agreement and VIP membership checkouts (recurring).
 * Same rules as invoice checkout (computeCheckoutFees): 2% on Flex/Founding/Startup, Flat = 0.
 * The $1.99 online-booking fee never applies here (not an online-booked invoice checkout).
 */
export function computeRecurringServiceFee(
  company: CompanySettingsCarrier,
  price: string
): RecurringServiceFee {
  const fees = computeCheckoutFees({
    chargeCents: moneyStringToCents(price),
    isOnlineBooking: false,
    paysInvoiceInFull: false,
    plan: readRenvaniSubscriptionPlan(company)
  });

  const total = fees.chargeCents + fees.serviceFeeCents;
  const applicationFeePercent =
    fees.serviceFeeCents > 0 && total > 0
      ? Math.round((fees.serviceFeeCents / total) * 10_000) / 100
      : null;

  return {
    chargeCents: fees.chargeCents,
    serviceFeeCents: fees.serviceFeeCents,
    serviceFeeRateBps: fees.serviceFeeRateBps,
    lineItemName: formatServiceFeeLineItemName(fees.serviceFeeRateBps),
    serviceFeeAmount: centsToMoneyString(fees.serviceFeeCents),
    applicationFeePercent
  };
}
