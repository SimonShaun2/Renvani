import { describe, expect, it, vi } from "vitest";

import {
  FALLBACK_HOME_PRICING,
  STATIC_PRODUCT_SECTIONS,
  PUBLISHED_HOME_PRICING,
  applyCopyRules,
  fallbackSections,
  hasVisibleContent,
  safeHref,
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

  it("falls back to the full snapshot on preview without env", async () => {
    const none = vi.fn();
    expect((await getPageSections("home", { VERCEL_ENV: "preview" }, none as unknown as typeof fetch)).length).toBe(14);
    expect(none).not.toHaveBeenCalled();
    const ok = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ fieldData: { page: "home", "section-key": "hero", headline: "CMS", "sort-order": 1 } }] })
    });
    const env = { WEBFLOW_API_TOKEN: "t", WEBFLOW_SITE_ID: "s", WEBFLOW_PAGE_SECTIONS_COLLECTION_ID: "c", VERCEL_ENV: "preview" };
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

describe("draft gating", () => {
  const base = { WEBFLOW_API_TOKEN: "t", WEBFLOW_SITE_ID: "s", WEBFLOW_PAGE_SECTIONS_COLLECTION_ID: "c" };
  const items = [
    { isDraft: true, fieldData: { page: "home", "section-key": "draft", headline: "Draft", "sort-order": 1 } },
    { isDraft: false, fieldData: { page: "home", "section-key": "live", headline: "Live", "sort-order": 2 } }
  ];
  const ok = () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items }) });

  it("uses the staged endpoint (drafts included) only on preview", async () => {
    const f = ok();
    const s = await getPageSections("home", { ...base, VERCEL_ENV: "preview" }, f as unknown as typeof fetch);
    expect(f.mock.calls[0]![0]).toBe("https://api.webflow.com/v2/collections/c/items?limit=100");
    expect(s.map((x) => x.headline)).toEqual(["Draft", "Live"]);
  });

  it.each([undefined, "production", "development"])("uses the live endpoint and drops drafts when VERCEL_ENV=%s", async (VERCEL_ENV) => {
    const f = ok();
    const s = await getPageSections("home", { ...base, VERCEL_ENV }, f as unknown as typeof fetch);
    expect(f.mock.calls[0]![0]).toBe("https://api.webflow.com/v2/collections/c/items/live?limit=100");
    expect(s.map((x) => x.headline)).toEqual(["Live"]);
  });

  it("outside preview the fallback has no drafts and uses the static copy when empty", async () => {
    expect(PUBLISHED_HOME_PRICING.length).toBe(0);
    for (const page of ["home", "pricing"]) {
      const s = fallbackSections(page, { VERCEL_ENV: "production" });
      expect(s.length).toBeGreaterThan(0);
      expect(s.every((x) => FALLBACK_HOME_PRICING.indexOf(x) === -1)).toBe(true);
    }
    const f = vi.fn().mockRejectedValue(new Error("down"));
    const s = await getPageSections("pricing", { ...base, VERCEL_ENV: "production" }, f as unknown as typeof fetch);
    expect(pricingFromSection(s.find((x) => x.data))!.plans.map((p) => p.monthly)).toEqual([399, 999, 199, 99]);
  });
});

describe("[Copy: …] placeholders", () => {
  it("hides fields, lines and sections that contain them", () => {
    const s = mapSection({ fieldData: { page: "x", "section-key": "y", headline: "[Copy: h]", subhead: "Ok [Copy: z]", items: "a — [Copy: v]" } })!;
    expect(s.headline).toBeUndefined();
    expect(s.subhead).toBeUndefined();
    expect(s.items).toEqual([]);
    expect(hasVisibleContent(s)).toBe(false);
    expect(JSON.stringify(STATIC_PRODUCT_SECTIONS)).not.toContain("[Copy:");
  });
});

describe("safeHref", () => {
  it.each([
    ["/demo", "/demo"], ["/founding-partners", "/founding-partners"], ["https://renvani.com", "https://renvani.com"],
    ["//evil.com", "/demo"], ["/\\evil.com", "/demo"], ["http://renvani.com", "/demo"], ["javascript:alert(1)", "/demo"],
    ["data:text/html,x", "/demo"], ["demo", "/demo"], ["mailto:a@b.c", "/demo"]
  ])("%s -> %s", (input, out) => expect(safeHref(input)).toBe(out));

  it("is applied when mapping CMS items", () => {
    expect(mapSection({ fieldData: { page: "p", "section-key": "k", "cta-href": "javascript:x" } })!.ctaHref).toBe("/demo");
  });
});
