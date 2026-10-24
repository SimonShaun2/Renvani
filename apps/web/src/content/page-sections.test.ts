import { describe, expect, it, vi } from "vitest";

import {
  FALLBACK_HOME_PRICING,
  STATIC_PRODUCT_SECTIONS,
  applyCopyRules,
  getPageSections,
  mapSection,
  pricingFromSection
} from "./page-sections";

describe("copy rules", () => {
  it("renders Platform fee (5%) as Service Fee (2%, paid by customer)", () => {
    expect(applyCopyRules("Platform fee (5%)")).toBe("Service Fee (2%, paid by customer)");
    expect(applyCopyRules("Platform fee (5%, paid by customer) $7.95")).toBe("Service Fee (2%, paid by customer) $7.95");
  });

  it("applies to static product sections", () => {
    expect(JSON.stringify(STATIC_PRODUCT_SECTIONS)).not.toMatch(/Platform fee/);
  });
});

describe("page sections", () => {
  it("drops review-notes during mapping", () => {
    const s = mapSection({ fieldData: { page: "home", "section-key": "hero", "review-notes": "note" } })!;
    expect(JSON.stringify(s)).not.toContain("note");
    expect(Object.keys(s)).not.toContain("reviewNotes");
    for (const section of FALLBACK_HOME_PRICING) expect(section).not.toHaveProperty("review-notes");
  });

  it("reads plans and the annual toggle from data-json", () => {
    const pricing = pricingFromSection(FALLBACK_HOME_PRICING.find((s) => s.page === "pricing" && s.sectionKey === "plans"))!;
    expect(pricing.defaultBilling).toBe("annual");
    expect(Object.fromEntries(pricing.plans.map((p) => [p.id, [p.monthly, p.annual]]))).toEqual({
      flex: [399, 3990], flat: [999, 9990], founding: [199, 1990], startup: [99, 990]
    });
    expect(pricing.bookingFee).toContain("$1.99");
  });

  it("falls back to the snapshot without env and fetches staged items with env", async () => {
    const none = vi.fn();
    expect((await getPageSections("home", {}, none as unknown as typeof fetch)).length).toBe(14);
    expect(none).not.toHaveBeenCalled();
    const ok = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ fieldData: { page: "home", "section-key": "hero", headline: "CMS", "sort-order": 1 } }] })
    });
    const env = { WEBFLOW_API_TOKEN: "t", WEBFLOW_SITE_ID: "s", WEBFLOW_PAGE_SECTIONS_COLLECTION_ID: "c" };
    const sections = await getPageSections("home", env, ok as unknown as typeof fetch);
    expect(ok.mock.calls[0]![0]).toBe("https://api.webflow.com/v2/collections/c/items?limit=100");
    expect(sections[0]!.headline).toBe("CMS");
    const fail = vi.fn().mockRejectedValue(new Error("x"));
    expect((await getPageSections("pricing", env, fail as unknown as typeof fetch)).length).toBe(5);
  });

  it("serves product pages from the static CMS-shaped copy", async () => {
    expect((await getPageSections("growth")).map((s) => s.sectionKey)).toEqual([
      "hero", "features", "how-agents-work", "outcomes", "demo-cta"
    ]);
  });
});
