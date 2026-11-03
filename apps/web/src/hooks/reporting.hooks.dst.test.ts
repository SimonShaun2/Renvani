import { describe, expect, it, vi } from "vitest";

// Pin a DST-observing zone before any Date use so results don't depend on the host TZ.
const guard = vi.hoisted(() => {
  process.env.TZ = "America/Chicago";
  return { calls: 0, cap: 5_000 };
});

// Bound the day loops: a regression (cursor not advancing) throws fast instead of OOMing.
vi.mock("date-fns", async (orig) => {
  const actual = await orig<typeof import("date-fns")>();
  return {
    ...actual,
    startOfDay: (d: Date | number | string) => {
      guard.calls += 1;
      if (guard.calls > guard.cap) throw new Error("day loop did not terminate (DST step regression)");
      return actual.startOfDay(d);
    }
  };
});

vi.mock("@/src/lib/api", () => ({ api: { get: vi.fn() } }));

import { buildRevenueChartData, getWorkingDaysBetween, type ReportingDataset } from "./reporting.hooks";

function dataset(start: Date, end: Date): ReportingDataset {
  return {
    range: { start, end, previousStart: start, previousEnd: end, dayCount: 0, currentLabel: "" },
    jobs: [], estimates: [], invoices: [], payments: [], reviews: [], technicians: []
  } as unknown as ReportingDataset;
}

const ALL = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

describe("reporting day loops across DST (America/Chicago)", () => {
  it("runs in a DST zone", () => {
    expect(new Date(2026, 10, 1, 0).getTimezoneOffset()).toBe(300);
    expect(new Date(2026, 10, 2, 0).getTimezoneOffset()).toBe(360);
  });

  it.each([
    ["fall-back Nov 1 2026 (25h)", new Date(2026, 9, 30), new Date(2026, 10, 3, 23, 59, 59, 999),
      ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"]],
    ["spring-forward Mar 8 2026 (23h)", new Date(2026, 2, 6), new Date(2026, 2, 10, 23, 59, 59, 999),
      ["2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"]]
  ])("buildRevenueChartData emits one point per calendar day: %s", (_label, start, end, keys) => {
    guard.calls = 0;
    const points = buildRevenueChartData(dataset(start, end));
    expect(points.map((p) => p.dateKey)).toEqual(keys);
  });

  it.each([
    ["fall-back", new Date(2026, 9, 30), new Date(2026, 10, 3, 23, 59, 59, 999), 5, 2],
    ["spring-forward", new Date(2026, 2, 6), new Date(2026, 2, 10, 23, 59, 59, 999), 5, 2]
  ])("getWorkingDaysBetween counts calendar days: %s", (_label, start, end, all, weekend) => {
    guard.calls = 0;
    expect(getWorkingDaysBetween(start, end, [...ALL])).toBe(all);
    guard.calls = 0;
    expect(getWorkingDaysBetween(start, end, ["sat", "sun"])).toBe(weekend);
  });
});
