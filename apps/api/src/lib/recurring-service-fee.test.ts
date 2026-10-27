import { describe, expect, it } from "vitest";
import { formatServiceFeeLineItemName, SERVICE_FEE_RATE_BPS } from "@fsm/config/stripe-pricing";
import { computeRecurringServiceFee } from "./recurring-service-fee.js";

const companyOn = (planTier: string | null) => ({
  settings: planTier ? { stripePlatformBilling: { planTier } } : {}
});

describe("computeRecurringServiceFee (service agreements + VIP)", () => {
  it("charges 2% Service Fee on Flex with label derived from SERVICE_FEE_RATE_BPS", () => {
    const fee = computeRecurringServiceFee(companyOn("flex"), "29.99");
    expect(fee.chargeCents).toBe(2999);
    expect(fee.serviceFeeCents).toBe(60);
    expect(fee.serviceFeeAmount).toBe("0.60");
    expect(fee.serviceFeeRateBps).toBe(SERVICE_FEE_RATE_BPS);
    expect(fee.lineItemName).toBe(formatServiceFeeLineItemName(SERVICE_FEE_RATE_BPS));
    expect(fee.lineItemName).toBe("Service Fee (2%)");
  });

  it.each(["founding", "startup", null])("treats %s (not representable / unset) as a fee plan", (tier) => {
    const fee = computeRecurringServiceFee(companyOn(tier), "100.00");
    expect(fee.serviceFeeCents).toBe(200);
    expect(fee.applicationFeePercent).toBe(1.96);
  });

  it("Flat pays no Service Fee and no application fee", () => {
    const fee = computeRecurringServiceFee(companyOn("flat"), "100.00");
    expect(fee.serviceFeeCents).toBe(0);
    expect(fee.serviceFeeRateBps).toBe(0);
    expect(fee.applicationFeePercent).toBeNull();
  });

  it("never applies the $1.99 booking fee; application fee recovers the Service Fee", () => {
    const fee = computeRecurringServiceFee(companyOn("flex"), "50.00");
    expect(fee.serviceFeeCents).toBe(100);
    const total = fee.chargeCents + fee.serviceFeeCents;
    expect(Math.round((total * (fee.applicationFeePercent ?? 0)) / 100)).toBe(fee.serviceFeeCents);
  });

  it("zero/invalid price yields no fee", () => {
    expect(computeRecurringServiceFee(companyOn("flex"), "0.00").serviceFeeCents).toBe(0);
  });
});
