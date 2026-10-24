import { describe, expect, it } from "vitest";

import {
  PLACEHOLDER_CONTENT,
  annualPrice,
  formatCounter,
  getMarketingContent,
  getVisual
} from "./marketing-content";

const COMPETITORS = /servicetitan|housecall|jobber|fieldedge|workiz/i;

describe("marketing content module", () => {
  it("returns all seven Figma visuals with the spec counter targets", async () => {
    const content = await getMarketingContent();
    expect(content.visuals.map((v) => v.slug)).toEqual([
      "home", "growth", "revenue", "operations", "retention", "command-center", "hvac"
    ]);
    const targets = Object.fromEntries(content.visuals.map((v) => [v.slug, formatCounter(v.counter.value, v.counter.format)]));
    expect(targets).toEqual({
      home: "$1,240", growth: "12", revenue: "$8,400", operations: "14",
      retention: "42", "command-center": "$12,480", hvac: "9"
    });
  });

  it("only Revenue and Command Center play the Approve click-through", () => {
    const click = PLACEHOLDER_CONTENT.visuals.filter((v) => v.clickThrough).map((v) => v.slug);
    expect(click).toEqual(["revenue", "command-center"]);
    expect(getVisual(PLACEHOLDER_CONTENT, "revenue").cardA.actionLabel).toBe("Approve");
  });

  it("names no competitors", () => {
    expect(JSON.stringify(PLACEHOLDER_CONTENT)).not.toMatch(COMPETITORS);
  });

  it("prices plans per the brief, annual is 2 months free", () => {
    const prices = Object.fromEntries(PLACEHOLDER_CONTENT.plans.map((p) => [p.id, [p.monthlyPrice, annualPrice(p.monthlyPrice)]]));
    expect(prices).toEqual({ flex: [399, 3990], flat: [999, 9990], founding: [199, 1990], startup: [99, 990] });
  });
});
