import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandedStorefront } from "./BrandedStorefront";
import { buildBrandedStorefrontViewModel } from "./branded-storefront.utils";

const settings = {
  companyName: "Summit Service",
  companySlug: "summit",
  bookingSlug: "summit",
  offeredServices: [] as Array<Record<string, unknown>>,
  availableHoursStart: 8,
  availableHoursEnd: 17,
  availableDays: ["mon"],
  slotDuration: 60,
  maxAdvanceDays: 30,
  googleReviewUrl: null,
  yelpReviewUrl: null,
  facebookReviewUrl: null
};

describe("BrandedStorefront", () => {
  it("routes a shop with no configured services to inquiry without fabricated prices or services", () => {
    const html = renderToStaticMarkup(<BrandedStorefront model={buildBrandedStorefrontViewModel(settings)} />);
    expect(html).toContain("Local service from Summit Service.");
    expect(html).toContain("/site/summit/inquire?src=website");
    expect(html).not.toContain("/book/summit?src=website");
    expect(html).not.toContain("$186");
    expect(html).not.toContain("AC tune-up");
    expect(html).not.toContain("Pricing");
  });

  it.each(["hvac", "plumbing"] as const)("shows configured %s trade and offered services only", (trade) => {
    const model = buildBrandedStorefrontViewModel({ ...settings, trade, offeredServices: [{ label: "Annual maintenance" }] });
    const html = renderToStaticMarkup(<BrandedStorefront model={model} />);
    expect(html).toContain(trade === "hvac" ? "Heating and cooling service" : "Plumbing service");
    expect(html).toContain("Annual maintenance");
    expect(html).toContain("/book/summit?src=website");
    expect(html).toContain("Check service options");
    expect(html).not.toContain("$186");
  });
});
