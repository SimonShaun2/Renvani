import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandedLocalSeo, serializeJsonLd } from "./BrandedLocalSeo";
import { buildBrandedStorefrontViewModel, buildLocalBusinessJsonLd } from "./branded-storefront.utils";
import { SITE_TRADES, buildSiteMetadataCopy, resolveSiteTrade } from "./site-trade.registry";

const base = {
  companyName: "Summit Heating",
  companySlug: "summit",
  bookingSlug: "summit",
  intakeMode: "inquiry_only" as const,
  offeredServices: [] as Array<Record<string, unknown>>,
  availableHoursStart: 8,
  availableHoursEnd: 17,
  availableDays: ["mon", "tue"],
  slotDuration: 60,
  maxAdvanceDays: 30,
  googleReviewUrl: null,
  yelpReviewUrl: null,
  facebookReviewUrl: null,
  phone: "555-0100",
  serviceAreaZipCodes: ["60601"]
};
const withServices = (...labels: string[]) => ({ ...base, intakeMode: labels.length > 0 ? "bookable" as const : "inquiry_only" as const, offeredServices: labels.map((label) => ({ label })) });

describe("site trade registry", () => {
  it.each([
    ["hvac", ["AC repair", "Furnace tune-up"], "HVACBusiness", "Heating & air conditioning"],
    ["plumbing", ["Drain cleaning", "Water heater install"], "Plumber", "Plumbing"],
    ["electrical", ["Panel upgrade", "EV charger install"], "Electrician", "Electrical"],
    [undefined, ["Handyman visit"], "HomeAndConstructionBusiness", "Home services"],
    [undefined, [], "HomeAndConstructionBusiness", "Home services"]
  ] as const)("%s configured trade → %s metadata", (trade, labels, schemaType, label) => {
    const meta = buildSiteMetadataCopy({ ...withServices(...labels), ...(trade ? { trade } : {}) });
    expect(meta.trade.schemaType).toBe(schemaType);
    expect(meta.title).toBe(`Summit Heating · ${label}`);
    expect(meta.keywords).toContain("Summit Heating");
  });

  it("has exactly hvac | plumbing | electrical | other", () => {
    expect(Object.keys(SITE_TRADES)).toEqual(["hvac", "plumbing", "electrical", "other"]);
    expect(JSON.stringify(SITE_TRADES).toLowerCase()).not.toMatch(/residential cleaning|maid|restaurant|menu/);
  });

  it.each(["hvac", "plumbing"] as const)("does not promise available services in zero-service %s metadata", (trade) => {
    const metadata = buildSiteMetadataCopy({ ...base, trade });
    expect(metadata.description).toContain("confirm service availability");
    expect(metadata.description).not.toContain("Review available services");
  });

  it("uses inquiry-only fallback copy for an unset trade in both hero and metadata", () => {
    const settings = { ...base, trade: null };
    const model = buildBrandedStorefrontViewModel(settings);
    const metadata = buildSiteMetadataCopy(settings);
    expect(model.tagline).toContain("Send an inquiry");
    expect(metadata.description).toContain("Send an inquiry");
    expect(model.tagline).not.toContain("Review available services");
    expect(metadata.description).not.toContain("Review available services");
  });

  it("retains configured-bookable fallback copy in both hero and metadata", () => {
    const settings = { ...withServices("AC repair"), trade: "hvac" as const };
    const model = buildBrandedStorefrontViewModel(settings);
    const metadata = buildSiteMetadataCopy(settings);
    expect(model.tagline).toContain("Review available services");
    expect(metadata.description).toContain("Review available services");
    expect(model.serviceCards[0]?.title).toBe("AC repair");
  });

  it("preserves an operator-provided tagline in both hero and metadata", () => {
    const tagline = "Family-owned plumbing team serving the north side.";
    const settings = { ...base, trade: "plumbing" as const, tagline };
    expect(buildBrandedStorefrontViewModel(settings).tagline).toBe(tagline);
    expect(buildSiteMetadataCopy(settings).description).toBe(tagline);
  });

  it.each(["cleaning", "restaurant", "", 42, null])("unknown or missing trade %j falls back to other", (trade) => {
    expect(resolveSiteTrade({ trade } as never).key).toBe("other");
  });

  it("does not infer trade from offered service labels", () => {
    expect(resolveSiteTrade({ ...withServices("Deep clean", "Move-out clean"), trade: null }).key).toBe("other");
    expect(resolveSiteTrade({ ...withServices("AC repair", "Furnace tune-up"), trade: null }).key).toBe("other");
  });

  it("prefers an explicit trade field when present", () => {
    expect(resolveSiteTrade({ ...withServices("Deep clean"), trade: "plumbing" } as never).key).toBe("plumbing");
  });

  it("emits phone and trade @type without claiming booking windows are business hours", () => {
    const settings = { ...withServices("AC repair"), trade: "hvac" as const };
    const ld = buildLocalBusinessJsonLd(buildBrandedStorefrontViewModel(settings), "/site/summit", {
      trade: resolveSiteTrade(settings)
    });
    expect(ld["@type"]).toBe("HVACBusiness");
    expect(ld.telephone).toBe("555-0100");
    expect(ld.openingHoursSpecification).toBeUndefined();
    expect(ld.aggregateRating).toBeUndefined();
    const rated = buildLocalBusinessJsonLd(buildBrandedStorefrontViewModel(settings), "/s", { rating: { value: 4.8, count: 12 } });
    expect(rated.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.8, reviewCount: 12 });
  });
});

describe("JSON-LD escaping", () => {
  it("escapes </script>, <!--, & and U+2028/2029", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script><!-- & \u2028\u2029" });
    expect(out).not.toMatch(/[<>\u2028\u2029]/);
    expect(out).not.toContain("&");
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script><!-- & \u2028\u2029" });
  });

  it("renders a single script tag for a malicious company name", () => {
    const model = buildBrandedStorefrontViewModel({ ...base, companyName: "Evil</script><script>alert(1)</script>" });
    const html = renderToStaticMarkup(<BrandedLocalSeo jsonLd={buildLocalBusinessJsonLd(model, "/site/x")} />);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).not.toContain("<script>alert");
  });
});
