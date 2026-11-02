import { describe, expect, it, vi } from "vitest";

vi.mock("@stripe/react-stripe-js", () => ({ EmbeddedCheckout: () => null, EmbeddedCheckoutProvider: () => null }));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn() }));

import { isEmbeddedCheckoutAvailable } from "./StripeEmbeddedInvoiceCheckout";

describe("isEmbeddedCheckoutAvailable", () => {
  it("is true with a client secret and a publishable key", () => {
    expect(isEmbeddedCheckoutAvailable("cs_test_secret", "pk_test_x")).toBe(true);
  });

  it("is false when the publishable key is missing or blank (falls back to the Pay link)", () => {
    expect(isEmbeddedCheckoutAvailable("cs_test_secret", "")).toBe(false);
    expect(isEmbeddedCheckoutAvailable("cs_test_secret", "   ")).toBe(false);
  });

  it("is false without a client secret", () => {
    expect(isEmbeddedCheckoutAvailable(null, "pk_test_x")).toBe(false);
  });
});
