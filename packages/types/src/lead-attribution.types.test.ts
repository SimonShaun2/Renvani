import { describe, expect, it } from "vitest";

import {
  LEAD_ATTRIBUTION_FIELDS,
  leadAttributionInputSchema,
  leadAttributionSourceKey,
  sanitizeLeadAttribution
} from "./lead-attribution.types.js";

describe("sanitizeLeadAttribution", () => {
  it("keeps whitelisted keys, trims and lowercases tokens, drops unknown keys", () => {
    expect(
      sanitizeLeadAttribution({ utm_source: "  Google  Ads ", utm_medium: "CPC", link_id: "Lk_9-a", extra: "x", __proto__: "y" })
    ).toEqual({ utm_source: "google ads", utm_medium: "cpc", link_id: "Lk_9-a" });
  });

  it("reduces referrers to host only", () => {
    expect(sanitizeLeadAttribution({ referrer_host: "https://www.Yelp.com/biz/x?utm=1#y" })).toEqual({ referrer_host: "yelp.com" });
    expect(sanitizeLeadAttribution({ referrer_host: "nextdoor.com" })).toEqual({ referrer_host: "nextdoor.com" });
    expect(sanitizeLeadAttribution({ referrer_host: "https://user:pw@evil.com/" })).toBeNull();
    expect(sanitizeLeadAttribution({ referrer_host: "javascript:alert(1)" })).toBeNull();
    expect(sanitizeLeadAttribution({ referrer_host: "localhost" })).toBeNull();
  });

  it("rejects emails, URLs, query strings, phone numbers and markup", () => {
    for (const value of [
      "jamie@example.com",
      "https://example.com",
      "spring?promo=1",
      "a=b&c=d",
      "/path",
      "+1 (555) 020-0200",
      "5550200200",
      "<script>",
      ""
    ]) {
      expect(sanitizeLeadAttribution({ utm_campaign: value }), value).toBeNull();
    }
    expect(sanitizeLeadAttribution({ ad_id: "has space" })).toBeNull();
  });

  it("enforces per-field length limits from the registry", () => {
    for (const [key, field] of Object.entries(LEAD_ATTRIBUTION_FIELDS)) {
      if (field.kind === "host") continue;
      expect(sanitizeLeadAttribution({ [key]: "a".repeat(field.maxLength) })).toEqual({ [key]: "a".repeat(field.maxLength) });
      expect(sanitizeLeadAttribution({ [key]: "a".repeat(field.maxLength + 1) })).toBeNull();
    }
    expect(sanitizeLeadAttribution({ referrer_host: `${"a".repeat(64)}.com` })).toBeNull();
  });

  it("ignores non-objects and non-string values", () => {
    for (const value of [null, undefined, "x", 1, ["utm_source"], { utm_source: 5 }, { utm_source: { a: 1 } }]) {
      expect(sanitizeLeadAttribution(value)).toBeNull();
    }
  });

  it("zod input schema never throws and yields undefined when empty", () => {
    expect(leadAttributionInputSchema.parse(undefined)).toBeUndefined();
    expect(leadAttributionInputSchema.parse("junk")).toBeUndefined();
    expect(leadAttributionInputSchema.parse({ utm_source: "fb" })).toEqual({ utm_source: "fb" });
  });

  it("derives the reporting source key", () => {
    expect(leadAttributionSourceKey({ utm_source: "google", referrer_host: "yelp.com" })).toBe("google");
    expect(leadAttributionSourceKey({ referrer_host: "yelp.com" })).toBe("yelp.com");
    expect(leadAttributionSourceKey({ ad_id: "1" })).toBe("direct");
    expect(leadAttributionSourceKey(null)).toBe("direct");
  });
});
