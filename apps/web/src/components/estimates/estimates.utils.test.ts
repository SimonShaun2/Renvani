import { describe, expect, it } from "vitest";

import {
  buildEstimatePublicPath,
  calculateLineTotal,
  computeRevenueTotals,
  formatMoneyInput,
  formatQuantityInput,
  type RevenueLineItemDraft
} from "./estimates.utils";

function item(quantity: string, unitPrice: string, isTaxable = true): RevenueLineItemDraft {
  return {
    localId: `${quantity}-${unitPrice}`,
    name: "Service",
    description: "",
    itemType: "service",
    quantity,
    unitPrice,
    isTaxable,
    sortOrder: 0
  };
}

describe("estimate decimal preview parity", () => {
  it("rounds each fractional-quantity line before summing the subtotal", () => {
    expect(calculateLineTotal("0.333", "0.05")).toBe("0.02");
    expect(computeRevenueTotals([item("0.333", "0.05"), item("0.333", "0.05"), item("0.333", "0.05")], 0, 0))
      .toEqual({ subtotal: 0.06, taxAmount: 0, discountAmount: 0, total: 0.06 });
  });

  it("normalizes half-cent input to the API's three- and two-decimal fields", () => {
    expect(formatQuantityInput("1.0005")).toBe("1.001");
    expect(formatMoneyInput("1.005")).toBe("1.01");
    expect(calculateLineTotal("1.0005", "1.005")).toBe("1.01");
  });

  it("keeps a large in-range extended price exact to cents", () => {
    expect(calculateLineTotal("999.999", "99999.99")).toBe("99999890.00");
    expect(formatMoneyInput(computeRevenueTotals([item("999.999", "99999.99")], 0, 0).total)).toBe("99999890.00");
  });

  it("calculates tax on taxable lines before the estimate discount", () => {
    expect(computeRevenueTotals([item("1", "100.00"), item("1", "20.00", false)], 0.1, 10))
      .toEqual({ subtotal: 120, taxAmount: 10, discountAmount: 10, total: 120 });
  });
});

describe("buildEstimatePublicPath", () => {
  it("uses the dedicated public approval route (not /estimates/:token)", () => {
    expect(buildEstimatePublicPath("customer-approval-token")).toBe("/approve/customer-approval-token");
    expect(buildEstimatePublicPath("customer-approval-token")).not.toMatch(/^\/estimates\//);
  });

  it("returns null when no token is provided", () => {
    expect(buildEstimatePublicPath(null)).toBeNull();
    expect(buildEstimatePublicPath(undefined)).toBeNull();
    expect(buildEstimatePublicPath("")).toBeNull();
  });
});

describe("matchesEstimateFilter (FS-174)", () => {
  it("treats viewed as sent and supports revised/converted", async () => {
    const { matchesEstimateFilter } = await import("./estimates.utils");
    expect(matchesEstimateFilter("viewed", "sent")).toBe(true);
    expect(matchesEstimateFilter("converted", "converted")).toBe(true);
    expect(matchesEstimateFilter("revised", "revised")).toBe(true);
    expect(matchesEstimateFilter("revised", "draft")).toBe(false);
    expect(matchesEstimateFilter("declined", "all")).toBe(true);
  });
});
