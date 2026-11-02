import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandedLocalSeo, serializeJsonLd } from "./BrandedLocalSeo";
import { buildBrandedStorefrontViewModel, buildLocalBusinessJsonLd } from "./branded-storefront.utils";
import { SITE_TRADES, buildOpeningHours, buildSiteMetadataCopy, resolveSiteTrade } from "./site-trade.registry";

const base = {
  companyName: "Summit Heating",
  companySlug: "summit",
  bookingSlug: "summit",
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
const withServices = (...labels: string[]) => ({ ...base, offeredServices: labels.map((label) => ({ label })) });

describe("site trade registry", () => {
  it.each([
    [["AC repair", "Furnace tune-up"], "HVACBusiness", "Heating & air conditioning"],
    [["Drain cleaning", "Water heater install"], "Plumber", "Plumbing"],
    [["Panel upgrade", "EV charger install"], "Electrician", "Electrical"],
    [["Handyman visit"], "HomeAndConstructionBusiness", "Home services"],
    [[], "HomeAndConstructionBusiness", "Home services"]
  ])("%j → %s", (labels, schemaType, label) => {
    const meta = buildSiteMetadataCopy(withServices(...labels));
    expect(meta.trade.schemaType).toBe(schemaType);
    expect(meta.title).toBe(`Summit Heating · ${label}`);
    expect(meta.keywords).toContain("Summit Heating");
  });

  it("has exactly hvac | plumbing | electrical | other", () => {
    expect(Object.keys(SITE_TRADES)).toEqual(["hvac", "plumbing", "electrical", "other"]);
    expect(JSON.stringify(SITE_TRADES).toLowerCase()).not.toMatch(/residential cleaning|maid|restaurant|menu/);
  });

  it.each(["cleaning", "restaurant", "", 42, null])("unknown or missing trade %j falls back to other", (trade) => {
    expect(resolveSiteTrade({ ...withServices("Handyman visit"), trade } as never).key).toBe("other");
  });

  it("an old cleaning-style service list no longer resolves to a cleaning trade", () => {
    expect(resolveSiteTrade(withServices("Deep clean", "Move-out clean")).key).toBe("other");
  });

  it("prefers an explicit trade field when present", () => {
    expect(resolveSiteTrade({ ...withServices("Deep clean"), trade: "plumbing" } as never).key).toBe("plumbing");
  });

  it("emits phone, opening hours and trade @type; no rating unless real", () => {
    const settings = withServices("AC repair");
    const ld = buildLocalBusinessJsonLd(buildBrandedStorefrontViewModel(settings), "/site/summit", {
      trade: resolveSiteTrade(settings),
      openingHours: buildOpeningHours(settings)
    });
    expect(ld["@type"]).toBe("HVACBusiness");
    expect(ld.telephone).toBe("555-0100");
    expect(ld.openingHoursSpecification?.[0]).toMatchObject({ dayOfWeek: ["Monday", "Tuesday"], opens: "08:00", closes: "17:00" });
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
