import { describe, expect, it } from "vitest";

import { isReceiptEmailAllowed } from "./receipt-consent.js";

describe("isReceiptEmailAllowed", () => {
  it("allows a customer with an email and default prefs", () => {
    expect(isReceiptEmailAllowed({ email: "a@b.co" })).toBe(true);
    expect(isReceiptEmailAllowed({ email: "a@b.co", doNotContact: false, prefersEmail: true })).toBe(true);
    expect(isReceiptEmailAllowed({ email: "a@b.co", doNotContact: null, prefersEmail: null })).toBe(true);
  });
  it("blocks missing/blank email, doNotContact, and prefersEmail=false", () => {
    expect(isReceiptEmailAllowed(null)).toBe(false);
    expect(isReceiptEmailAllowed({ email: null })).toBe(false);
    expect(isReceiptEmailAllowed({ email: "  " })).toBe(false);
    expect(isReceiptEmailAllowed({ email: "a@b.co", doNotContact: true })).toBe(false);
    expect(isReceiptEmailAllowed({ email: "a@b.co", prefersEmail: false })).toBe(false);
  });
});
