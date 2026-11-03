import { describe, expect, it } from "vitest";

import { buildCardStatementDescriptor, RENVANI_STRIPE_BRAND } from "./stripe-branding.js";

describe("stripe-branding", () => {
  it("uses shop name when it fits statement descriptor limits", () => {
    expect(buildCardStatementDescriptor("Acme HVAC")).toBe("ACME HVAC");
  });

  it("falls back to RENVANI prefix for long shop names", () => {
    const descriptor = buildCardStatementDescriptor("ABCDEFGHIJKLMNOPQRSTUVW");
    expect(descriptor.startsWith(RENVANI_STRIPE_BRAND.defaultStatementPrefix)).toBe(true);
    expect(descriptor.length).toBeLessThanOrEqual(22);
  });

  it("defaults to RENVANI when shop name missing", () => {
    expect(buildCardStatementDescriptor(null)).toBe(RENVANI_STRIPE_BRAND.defaultStatementPrefix);
  });
});
