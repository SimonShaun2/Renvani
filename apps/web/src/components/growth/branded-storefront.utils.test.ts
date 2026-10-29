import { describe, expect, it } from "vitest";

import {
  buildBookPath,
  buildBrandedStorefrontViewModel,
  buildInquirePath,
  buildLocalBusinessJsonLd,
  buildReviewLinks,
  buildServiceAreaSummary,
  buildServiceCards
} from "./branded-storefront.utils";

const baseSettings = {
  companyName: "Sparkle & Co.",
  companySlug: "sparkle-co",
  bookingSlug: "sparkle-co",
  offeredServices: [],
  availableHoursStart: 8,
  availableHoursEnd: 17,
  availableDays: ["mon"],
  slotDuration: 60,
  maxAdvanceDays: 30,
  googleReviewUrl: null,
  yelpReviewUrl: null,
  facebookReviewUrl: null,
  serviceAreaZipCodes: []
};

describe("branded-storefront.utils", () => {
  it("builds book path with website attribution", () => {
    expect(buildBookPath("sparkle-co")).toBe("/book/sparkle-co?src=website");
  });

  it("builds inquire path for direct acquisition", () => {
    expect(buildInquirePath("sparkle-co")).toBe("/site/sparkle-co/inquire?src=website");
  });

  it("summarizes service area zips for local SEO copy", () => {
    expect(buildServiceAreaSummary(["90210", "90211", "90210"])).toContain("90210");
  });

  it("emits LocalBusiness JSON-LD without fabricated ratings", () => {
    const model = buildBrandedStorefrontViewModel({
      ...baseSettings,
      serviceAreaZipCodes: ["97201"]
    });
    const jsonLd = buildLocalBusinessJsonLd(model, "/site/sparkle-co");

    expect(jsonLd["@type"]).toBe("LocalBusiness");
    expect(jsonLd.areaServed).toEqual(["97201"]);
    expect(JSON.stringify(jsonLd)).not.toContain("aggregateRating");
  });

  it("maps offered services into storefront cards", () => {
    const cards = buildServiceCards([
      { label: "Deep clean", priceHint: "from $219" },
      { name: "Recurring", subtitle: "save 10%" }
    ]);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.title).toBe("Deep clean");
  });

  it("does not fabricate a public trust line", () => {
    const model = buildBrandedStorefrontViewModel(baseSettings);

    expect(model.trustLine).toBeNull();
    expect(model.reviewLinks).toHaveLength(0);
  });

  it("builds review links only from configured URLs", () => {
    const links = buildReviewLinks({
      ...baseSettings,
      googleReviewUrl: "https://google.com/reviews/acme"
    });

    expect(links).toEqual([{ label: "Google reviews", href: "https://google.com/reviews/acme" }]);
  });

  it.each([
    ["HVAC", "Heating & air conditioning inquiry"],
    ["plumbing", "Plumbing inquiry"],
    ["unknown", "Service inquiry"]
  ])("uses a verified or neutral fallback card for %s", (trade, title) => {
    const settings = { ...baseSettings, trade };
    const model = buildBrandedStorefrontViewModel(settings);

    expect(model.serviceCards).toEqual([
      { id: "service-inquiry", title, subtitle: "Tell us what you need to request a quote" }
    ]);
    expect(model.tagline).toBe("Tell us what you need and request a quote from our team.");
    expect(model.bookingSlug).toBe("sparkle-co");
  });
});
