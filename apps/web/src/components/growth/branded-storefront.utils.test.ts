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
      { label: "AC tune-up", priceHint: "from $219" },
      { name: "Recurring", subtitle: "save 10%" }
    ]);

    expect(cards).toHaveLength(2);
    expect(cards[0]?.title).toBe("AC tune-up");
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

  it("falls back to home-services cards when settings are empty", () => {
    const model = buildBrandedStorefrontViewModel(baseSettings);

    expect(model.serviceCards.length).toBe(4);
    expect(model.serviceCards.map((c) => c.id)).toEqual(["hvac", "plumbing", "electrical", "maintenance"]);
    expect(model.bookingSlug).toBe("sparkle-co");
  });
});
