import { describe, expect, it } from "vitest";
import {
  buildDispatchWeekCalendar,
  weekJobOverlaps,
} from "./dispatch-week.calendar.js";

const now = new Date("2026-11-02T02:30:00Z");
describe("weekly dispatch calendar", () => {
  it("uses the company's date, not UTC or the browser date, when date is omitted", () => {
    const c = buildDispatchWeekCalendar("America/Chicago", undefined, now);
    expect(c.today).toBe("2026-11-01");
    expect(c.weekStart).toBe("2026-10-26");
    expect(
      buildDispatchWeekCalendar("Asia/Tokyo", undefined, now).weekStart,
    ).toBe("2026-11-02");
  });
  it("starts on Monday even for a Sunday anchor", () => {
    expect(buildDispatchWeekCalendar("UTC", "2026-11-08", now).weekStart).toBe(
      "2026-11-02",
    );
  });
  it("handles a year boundary and returns seven actual dates", () => {
    const c = buildDispatchWeekCalendar("America/Chicago", "2027-01-01", now);
    expect(c.days.map((x) => x.date)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
    expect(c.previousWeek).toBe("2026-12-21");
    expect(c.nextWeek).toBe("2027-01-04");
  });
  it("preserves leap day", () => {
    expect(
      buildDispatchWeekCalendar("UTC", "2028-02-29", now).days.some(
        (x) => x.date === "2028-02-29",
      ),
    ).toBe(true);
  });
  it.each([
    ["2026-03-08", 167, 23],
    ["2026-11-01", 169, 25],
  ] as const)(
    "uses local-day boundaries across DST on %s",
    (date, weekHours, dayHours) => {
      const c = buildDispatchWeekCalendar("America/Chicago", date, now);
      expect(
        (Date.parse(c.rangeEndExclusive) - Date.parse(c.rangeStart)) / 3600000,
      ).toBe(weekHours);
      const day = c.days.find((d) => d.date === date)!;
      expect(
        (Date.parse(day.endExclusive) - Date.parse(day.start)) / 3600000,
      ).toBe(dayHours);
      for (let i = 1; i < c.days.length; i++)
        expect(c.days[i]?.start).toBe(c.days[i - 1]?.endExclusive);
    },
  );
  it.each(["", "Not/AZone", "+05:00"])(
    "rejects invalid or unnamed timezone %s",
    (zone) => {
      expect(() => buildDispatchWeekCalendar(zone, "2026-11-05", now)).toThrow(
        /timezone/,
      );
    },
  );
  it.each(["2026-02-30", "2026-13-01", "bad", "2026-11-05T00:00:00Z"])(
    "rejects invalid date %s",
    (date) => {
      expect(() => buildDispatchWeekCalendar("UTC", date, now)).toThrow(/date/);
    },
  );
  it("rejects a nonexistent local calendar day instead of presenting a duplicate day", () => {
    expect(() =>
      buildDispatchWeekCalendar("Pacific/Apia", "2011-12-30", now),
    ).toThrow(/date/);
  });
  it("includes overnight overlap but excludes exact midnight endings from the next day", () => {
    const c = buildDispatchWeekCalendar("America/Chicago", "2026-11-03", now);
    const job = {
      scheduledStart: "2026-11-03T05:00:00Z",
      scheduledEnd: "2026-11-03T07:00:00Z",
      timingWarning: null,
    };
    expect(
      c.days
        .filter((d) => weekJobOverlaps(job, d.start, d.endExclusive))
        .map((d) => d.date),
    ).toEqual(["2026-11-02", "2026-11-03"]);
    expect(
      c.days
        .filter((d) =>
          weekJobOverlaps(
            { ...job, scheduledEnd: "2026-11-03T06:00:00Z" },
            d.start,
            d.endExclusive,
          ),
        )
        .map((d) => d.date),
    ).toEqual(["2026-11-02"]);
  });
  it("locates missing or invalid ends only on the start day", () => {
    const c = buildDispatchWeekCalendar("America/Chicago", "2026-11-03", now);
    for (const timingWarning of ["missing_end", "invalid_end"] as const) {
      const job = {
        scheduledStart: "2026-11-03T07:00:00Z",
        scheduledEnd: null,
        timingWarning,
      };
      expect(
        c.days
          .filter((d) => weekJobOverlaps(job, d.start, d.endExclusive))
          .map((d) => d.date),
      ).toEqual(["2026-11-03"]);
    }
  });
});
