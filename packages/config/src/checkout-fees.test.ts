import { describe, expect, it } from "vitest";

import {
  computeCheckoutFees,
  computeRefundableCents,
  computeServiceFeeCents,
  formatServiceFeeLineItemName,
  moneyStringToCents,
  RENVANI_PLAN_MONTHLY_PRICE_CENTS,
  renvaniPlanAnnualPriceCents,
  SERVICE_FEE_RATE_BPS,
  serviceFeeRateBpsForPlan
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
    const fees = computeCheckoutFees({ chargeCents: 15_000 });
    expect(fees).toEqual({
      chargeCents: 15_000,
      serviceFeeCents: 300,
      totalCents: 15_300,
      serviceFeeRateBps: 200,
      feeRefundable: false
    });
  });

  it("no online-booking fee: total = invoice + Service Fee only", () => {
    const fees = computeCheckoutFees({ chargeCents: 10_000 });
    expect(fees.totalCents).toBe(10_200);
    expect(fees).not.toHaveProperty("bookingFeeCents");
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

  describe("per plan (Flat pays no Service Fee; no booking fee on any plan)", () => {
    const cases = [
      { plan: "flex", rate: 200, service: 247 },
      { plan: "founding", rate: 200, service: 247 },
      { plan: "startup", rate: 200, service: 247 },
      { plan: "flat", rate: 0, service: 0 },
      { plan: null, rate: 200, service: 247 },
      { plan: undefined, rate: 200, service: 247 }
    ] as const;

    for (const c of cases) {
      it(`${String(c.plan)}: rate ${c.rate} bps, service ${c.service}c, no booking fee`, () => {
        expect(serviceFeeRateBpsForPlan(c.plan)).toBe(c.rate);
        const online = computeCheckoutFees({ chargeCents: 12_325, plan: c.plan });
        expect(online).toEqual({
          chargeCents: 12_325,
          serviceFeeCents: c.service,
          totalCents: 12_325 + c.service,
          serviceFeeRateBps: c.rate,
          feeRefundable: false
        });
        // rounding half up: 25c -> 0.5c -> 1c on fee plans, 0 on Flat
        expect(computeCheckoutFees({ chargeCents: 25, plan: c.plan }).serviceFeeCents)
          .toBe(c.rate > 0 ? 1 : 0);
        expect(computeCheckoutFees({ chargeCents: 0, plan: c.plan }).totalCents).toBe(0);
      });
    }
  });

  it("Service Fee label derives from the rate", () => {
    expect(formatServiceFeeLineItemName()).toBe("Service Fee (2%)");
    expect(formatServiceFeeLineItemName(SERVICE_FEE_RATE_BPS)).toBe("Service Fee (2%)");
    expect(formatServiceFeeLineItemName(250)).toBe("Service Fee (2.5%)");
  });
});
