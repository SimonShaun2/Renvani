import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) => readFileSync(join(__dirname, file), "utf8");

describe("390px audit fixes (tap targets >= 44px, no squeezed pills or tables)", () => {
  it("inventory LOW pill never wraps or shrinks on mobile cards", () => {
    const s = source("inventory/InventoryClient.tsx");
    expect(s).toMatch(/inline-flex h-\[22px\] w-fit shrink-0 items-center whitespace-nowrap/);
    expect(s).toMatch(/<span className="shrink-0 lg:hidden">\s*<Pill tone="error">Low<\/Pill>/);
  });
  it("report share Revoke button is 44px tall", () => {
    expect(source("growth-check/ReportEditor.tsx")).toMatch(/inline-flex min-h-11 items-center px-2[^`]*`\} onClick=\{\(\) => setRevokeId/);
  });
  it("back links and the series Has a job link are 44px tall", () => {
    expect(source("estimate-option-sets/EstimateOptionSetClient.tsx")).toMatch(/className="inline-flex min-h-11 items-center[^"]*">\s*← Back to estimate/);
    const series = source("recurring-series/RecurringSeriesClient.tsx");
    expect(series).toMatch(/className="inline-flex min-h-11 items-center[^"]*">\s*<ArrowLeft[^>]*\/>\s*Back to Agreements/);
    expect(series).toMatch(/className="inline-flex min-h-11 items-center underline"[^>]*>\s*Has a job/);
  });
  it("call tracking calls table scrolls inside its wrapper", () => {
    const ct = source("call-tracking/CallTrackingClient.tsx");
    expect(ct).toContain('<section aria-labelledby="ct-calls" className={`${card} min-w-0`}>');
    expect(ct).toMatch(/<div className="overflow-x-auto">\s*<table className="w-full min-w-\[560px\]/);
  });
});
