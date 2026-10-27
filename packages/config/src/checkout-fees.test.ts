import { describe, expect, it } from "vitest";

import {
  computeCheckoutFees,
  computeRefundableCents,
  computeServiceFeeCents,
  moneyStringToCents,
  ONLINE_BOOKING_FEE_CENTS,
  RENVANI_PLAN_MONTHLY_PRICE_CENTS,
  renvaniPlanAnnualPriceCents
} from "./stripe-pricing.js";

describe("checkout fees", () => {
  it("Service Fee is 2% in integer cents, rounded half up", () => {
    expect(computeServiceFeeCents(10_000)).toBe(200);
    expect(computeServiceFeeCents(25)).toBe(1); // 0.5c -> 1c (half up)
    expect(computeServiceFeeCents(24)).toBe(0); // 0.48c -> 0c
    expect(computeServiceFeeCents(12_345)).toBe(247); // 246.9 -> 247
    expect(computeServiceFeeCents(12_325)).toBe(247); // 246.5 -> 247
    expect(computeServiceFeeCents(0)).toBe(0);
    expect(computeServiceFeeCents(-100)).toBe(0);
  });

  it("fees are separate lines on top of the charge and non-refundable", () => {
    const fees = computeCheckoutFees({ chargeCents: 15_000, isOnlineBooking: false, paysInvoiceInFull: true });
    expect(fees).toEqual({
      chargeCents: 15_000,
      serviceFeeCents: 300,
      bookingFeeCents: 0,
      totalCents: 15_300,
      serviceFeeRateBps: 200,
      feeRefundable: false
    });
  });

  it("booking fee only when an online-booked invoice is paid in full", () => {
    expect(
      computeCheckoutFees({ chargeCents: 10_000, isOnlineBooking: true, paysInvoiceInFull: true }).bookingFeeCents
    ).toBe(ONLINE_BOOKING_FEE_CENTS);
    expect(
      computeCheckoutFees({ chargeCents: 10_000, isOnlineBooking: true, paysInvoiceInFull: false }).bookingFeeCents
    ).toBe(0);
    expect(
      computeCheckoutFees({ chargeCents: 0, isOnlineBooking: true, paysInvoiceInFull: true }).bookingFeeCents
    ).toBe(0);
    const paid = computeCheckoutFees({ chargeCents: 10_000, isOnlineBooking: true, paysInvoiceInFull: true });
    expect(paid.totalCents).toBe(10_000 + 200 + 199);
  });

  it("refunds never include fees", () => {
    expect(computeRefundableCents({ amountCents: 10_000, amountRefundedCents: 0 })).toBe(10_000);
    expect(computeRefundableCents({ amountCents: 10_000, amountRefundedCents: 4_000 })).toBe(6_000);
    expect(computeRefundableCents({ amountCents: 10_000, amountRefundedCents: 12_000 })).toBe(0);
  });

  it("plan prices (annual = 10x monthly)", () => {
    expect(RENVANI_PLAN_MONTHLY_PRICE_CENTS).toEqual({ flex: 39_900, flat: 99_900, founding: 19_900, startup: 9_900 });
    expect(renvaniPlanAnnualPriceCents("flat")).toBe(999_000);
  });

  it("money string to cents", () => {
    expect(moneyStringToCents("150.00")).toBe(15_000);
    expect(moneyStringToCents("0.29")).toBe(29);
    expect(moneyStringToCents("1.005")).toBe(101);
  });
});
