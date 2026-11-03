import { describe, expect, it } from "vitest";

import {
  localDateTimeToUtc,
  planOccurrenceLocalDates,
  todayLocalDate
} from "./recurring-visit-occurrence.schedule.js";

describe("recurring visit occurrence schedule (FS-59)", () => {
  it("steps monthly local dates across DST spring-forward in America/New_York", () => {
    const dates = planOccurrenceLocalDates("2026-02-09", "monthly", 3);
    expect(dates).toEqual(["2026-02-09", "2026-03-09", "2026-04-09"]);

    const beforeDst = localDateTimeToUtc("2026-03-07", "09:00", "America/New_York");
    const afterDst = localDateTimeToUtc("2026-03-09", "09:00", "America/New_York");
    expect(beforeDst.getUTCHours()).toBe(14);
    expect(afterDst.getUTCHours()).toBe(13);
  });

  it("generates quarterly dates from anchor", () => {
    expect(planOccurrenceLocalDates("2026-01-15", "quarterly", 4)).toEqual([
      "2026-01-15",
      "2026-04-15",
      "2026-07-15",
      "2026-10-15"
    ]);
  });

  it("computes each date from the anchor so month-end anchors do not drift (Jan 31)", () => {
    expect(planOccurrenceLocalDates("2026-01-31", "monthly", 5)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31"
    ]);
    expect(planOccurrenceLocalDates("2027-11-30", "quarterly", 2)).toEqual(["2027-11-30", "2028-02-29"]);
  });

  it("todayLocalDate uses the company time zone, not UTC", () => {
    const lateEveningChicago = new Date("2026-03-02T03:30:00Z");
    expect(todayLocalDate("America/Chicago", lateEveningChicago)).toBe("2026-03-01");
    expect(todayLocalDate("UTC", lateEveningChicago)).toBe("2026-03-02");
  });
});
