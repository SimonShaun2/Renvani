import {
  centsToMoneyString,
  computeCheckoutFees,
  formatServiceFeeLineItemName,
  moneyStringToCents
} from "@fsm/config/stripe-pricing";
import type { ChargePreview } from "@fsm/types";

import { readRenvaniSubscriptionPlan } from "./company-renvani-plan.js";

/**
 * Customer-facing total preview for a subtotal, using checkout fee rules (computeCheckoutFees):
 * 2% Service Fee on Flex (and unset/legacy plans), none on Flat. No booking fee (removed 2026-10-27).
 * Preview only; checkout recomputes from the invoice balance.
 */
export function buildChargePreview(company: { settings: unknown }, subtotal: string): ChargePreview {
  const plan = readRenvaniSubscriptionPlan(company);
  const fees = computeCheckoutFees({ chargeCents: moneyStringToCents(subtotal), plan });
  return {
    plan,
    subtotal: centsToMoneyString(fees.chargeCents),
    serviceFeeAmount: centsToMoneyString(fees.serviceFeeCents),
    serviceFeeRateBps: fees.serviceFeeCents > 0 ? fees.serviceFeeRateBps : 0,
    serviceFeeLabel: fees.serviceFeeCents > 0 ? formatServiceFeeLineItemName(fees.serviceFeeRateBps) : null,
    total: centsToMoneyString(fees.totalCents)
  };
}
