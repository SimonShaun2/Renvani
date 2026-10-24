import { describe, expect, it, vi } from "vitest";

import {
  PLACEHOLDER_CONTENT,
  annualPrice,
  formatCounter,
  getMarketingContent,
  getVisual,
  mapWebflowItem
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

describe("Webflow CMS fetch", () => {
  const env = { WEBFLOW_API_TOKEN: "test", WEBFLOW_SITE_ID: "site", WEBFLOW_PRODUCT_VISUALS_COLLECTION_ID: "col" };
  const item = {
    isDraft: true,
    fieldData: {
      slug: "revenue", "sort-order": 3, "panel-title": "Approvals inbox (CMS)",
      "panel-rows": "Row A — meta A | Row B — meta B | Row C — meta C",
      "card-a-title": "Approve it?", "card-a-caption": "cap", "card-a-chip": "Awaiting owner approval",
      "card-b-title": "B", "card-b-caption": "b cap", "card-b-chip": "Handled by agent",
      "counter-target": 5000, "counter-prefix": "$", "counter-label": "lbl", "cursor-click-through": true,
      "desktop-image": { url: "https://cdn.example/x.png" }, "image-alt": "alt"
    }
  };

  it("falls back to placeholders without env", async () => {
    const fetchImpl = vi.fn();
    expect(await getMarketingContent({}, fetchImpl as any)).toBe(PLACEHOLDER_CONTENT);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to placeholders when the fetch fails", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("down"));
    expect(await getMarketingContent(env, failing as any)).toBe(PLACEHOLDER_CONTENT);
    const notOk = vi.fn().mockResolvedValue({ ok: false });
    expect(await getMarketingContent(env, notOk as any)).toBe(PLACEHOLDER_CONTENT);
  });

  it("calls the staged items endpoint with a bearer token and maps fields", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [item] }) });
    const content = await getMarketingContent(env, fetchImpl as any);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://api.webflow.com/v2/collections/col/items?limit=100");
    expect(init.headers.Authorization).toBe("Bearer test");
    const v = getVisual(content, "revenue");
    expect(v.panelTitle).toBe("Approvals inbox (CMS)");
    expect(v.rows.map((r) => [r.title, r.meta])).toEqual([["Row A", "meta A"], ["Row B", "meta B"], ["Row C", "meta C"]]);
    expect(v.cardB.chip).toBe("agent");
    expect(formatCounter(v.counter.value, v.counter.format)).toBe("$5,000");
    expect(v.clickThrough).toBe(true);
    expect(v.cardA.actionLabel).toBe("Approve");
    expect(getVisual(content, "growth")).toBe(getVisual(PLACEHOLDER_CONTENT, "growth"));
  });

  it("maps a null prefix to an integer counter", () => {
    const mapped = mapWebflowItem({ fieldData: { slug: "growth", "counter-target": 12, "counter-prefix": null } });
    expect(mapped && formatCounter(mapped.counter.value, mapped.counter.format)).toBe("12");
  });
});
