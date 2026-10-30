import { describe, expect, it } from "vitest";

import * as copy from "./marketing-copy";
import { FEATURE_TILES, HERO_COPY, MARKETING_BRAND, MARKETING_META, PILLARS } from "./marketing-copy";

const allCopy = JSON.stringify(copy);

describe("marketing-copy", () => {
  it("uses Renvani branding for getrenvani.com", () => {
    expect(MARKETING_BRAND.name).toBe("Renvani");
    expect(MARKETING_BRAND.domain).toBe("getrenvani.com");
  });

  it("leads with the growth headline", () => {
    expect(HERO_COPY.headline).toBe("Grow your shop. Renvani runs the rest.");
    expect(PILLARS).toHaveLength(3);
    expect(FEATURE_TILES.length).toBeGreaterThanOrEqual(8);
  });

  it("drops legacy positioning, competitor names, and unbacked stats", () => {
    expect(allCopy).not.toMatch(/revenue intelligence|ServiceRev|ServiceTitan|Housecall/i);
    expect(allCopy).not.toMatch(/\$\d|\d+%/);
  });

  it("defines SEO metadata", () => {
    expect(MARKETING_META.title.length).toBeGreaterThan(10);
    expect(MARKETING_META.description).toMatch(/Renvani/i);
  });
});
