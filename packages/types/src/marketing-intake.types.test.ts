import { describe, expect, it } from "vitest";

import { MarketingDemoRequestBodySchema, MarketingGrowthCheckBodySchema } from "./marketing-intake.types.js";

const demo = { name: " Ann ", email: " Ann@Example.COM ", company: " Acme ", trade: "hvac", message: " hi " };
const gc = { websiteUrl: "https://acme.example", trade: "plumbing", zip: "74103", email: "a@b.co" };

describe("marketing intake schemas", () => {
  it("trims and normalizes demo requests", () => {
    expect(MarketingDemoRequestBodySchema.parse({ ...demo, phone: "(918) 555-0100" })).toEqual({
      name: "Ann", email: "ann@example.com", company: "Acme", trade: "hvac", message: "hi", phone: "+19185550100"
    });
    expect(MarketingDemoRequestBodySchema.parse({ ...demo, phone: "" }).phone).toBeUndefined();
  });
  it.each([
    ["extra field", { ...demo, x: 1 }],
    ["bad trade", { ...demo, trade: "roofing" }],
    ["bad email", { ...demo, email: "nope" }],
    ["bad phone", { ...demo, phone: "12345" }],
    ["phone letters", { ...demo, phone: "555-CALL-NOW1" }],
    ["empty name", { ...demo, name: "  " }],
    ["long company", { ...demo, company: "x".repeat(161) }],
    ["long message", { ...demo, message: "x".repeat(2001) }]
  ])("rejects demo: %s", (_n, body) => {
    expect(MarketingDemoRequestBodySchema.safeParse(body).success).toBe(false);
  });
  it("growth check requires zip or city and http(s) URL", () => {
    expect(MarketingGrowthCheckBodySchema.parse({ ...gc, zip: undefined, city: " Tulsa " }).city).toBe("Tulsa");
    for (const body of [
      { ...gc, zip: undefined },
      { ...gc, zip: "7410" },
      { ...gc, websiteUrl: "ftp://acme.example" },
      { ...gc, websiteUrl: "javascript:alert(1)" },
      { ...gc, websiteUrl: "https://u:p@acme.example" },
      { ...gc, city: "x".repeat(101) },
      { ...gc, extra: true }
    ]) {
      expect(MarketingGrowthCheckBodySchema.safeParse(body).success).toBe(false);
    }
  });
});
