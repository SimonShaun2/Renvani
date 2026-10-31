import { describe, expect, it } from "vitest";

import {
  GROWTH_CHECK_DEFAULT_RUBRIC_ID,
  GROWTH_CHECK_TRADE_RUBRIC_REGISTRY,
  HOME_SERVICES_RUBRIC_V1,
  RESIDENTIAL_CLEANING_RUBRIC_V1,
  getGrowthCheckRubricById,
  resolveGrowthCheckRubricIdForTrade
} from "./index.js";

describe("growth check default rubric", () => {
  it("defaults new scans to the home-services rubric", () => {
    expect(GROWTH_CHECK_DEFAULT_RUBRIC_ID).toBe(HOME_SERVICES_RUBRIC_V1.id);
    expect(GROWTH_CHECK_DEFAULT_RUBRIC_ID).toBe("home-services");
  });

  it("maps every shop trade to a registered rubric", () => {
    for (const trade of ["hvac", "plumbing", "electrical", "other"]) {
      const id = resolveGrowthCheckRubricIdForTrade(trade);
      expect(getGrowthCheckRubricById(id)).not.toBeNull();
      expect(id).toBe("home-services");
    }
    expect(Object.keys(GROWTH_CHECK_TRADE_RUBRIC_REGISTRY).sort()).toEqual(["electrical", "hvac", "other", "plumbing"]);
  });

  it("falls back to the default for missing, unknown or prototype trades", () => {
    expect(resolveGrowthCheckRubricIdForTrade(null)).toBe("home-services");
    expect(resolveGrowthCheckRubricIdForTrade(undefined)).toBe("home-services");
    expect(resolveGrowthCheckRubricIdForTrade("roofing")).toBe("home-services");
    expect(resolveGrowthCheckRubricIdForTrade("__proto__")).toBe("home-services");
  });

  it("keeps the legacy rubric resolvable for stored scans", () => {
    expect(getGrowthCheckRubricById(RESIDENTIAL_CLEANING_RUBRIC_V1.id)).toBe(RESIDENTIAL_CLEANING_RUBRIC_V1);
    expect(getGrowthCheckRubricById("nope")).toBeNull();
  });
});
