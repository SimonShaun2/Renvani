import { describe, expect, it } from "vitest";

import {
  canViewReminderCandidates,
  describeDaysSince,
  describeDaysUntilDue,
  formatLocalDate,
  groupByRuleFamily,
  parseHorizonDays,
  parseLapsedDays,
  parseLocalDate
} from "./reminder-candidates.utils";

describe("reminder candidate utils", () => {
  it("matches API roles", () => {
    for (const r of ["owner", "admin", "dispatcher"]) expect(canViewReminderCandidates(r)).toBe(true);
    for (const r of ["office", "technician", null, undefined]) expect(canViewReminderCandidates(r)).toBe(false);
  });

  it("validates horizonDays 1-90 (required)", () => {
    expect(parseHorizonDays("14")).toEqual({ ok: true, value: 14 });
    expect(parseHorizonDays("1")).toEqual({ ok: true, value: 1 });
    expect(parseHorizonDays("90")).toEqual({ ok: true, value: 90 });
    for (const bad of ["0", "91", "", "2.5", "-3", "abc"]) expect(parseHorizonDays(bad).ok).toBe(false);
  });

  it("validates lapsedDays 1-730 (optional)", () => {
    expect(parseLapsedDays("")).toEqual({ ok: true, value: undefined });
    expect(parseLapsedDays("730")).toEqual({ ok: true, value: 730 });
    for (const bad of ["0", "731", "1.5"]) expect(parseLapsedDays(bad).ok).toBe(false);
  });

  it("parses dates as local calendar days", () => {
    const d = parseLocalDate("2026-11-02")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 2]);
    expect(parseLocalDate("2026-11-02T00:00:00.000Z")!.getDate()).toBe(2);
    expect(parseLocalDate(null)).toBeNull();
    expect(formatLocalDate("2026-11-02")).toBe("Nov 2, 2026");
    expect(formatLocalDate(null)).toBe("—");
  });

  it("describes days", () => {
    expect(describeDaysUntilDue(0)).toBe("Due today");
    expect(describeDaysUntilDue(1)).toBe("In 1 day");
    expect(describeDaysUntilDue(-2)).toBe("2 days overdue");
    expect(describeDaysUntilDue(null)).toBe("—");
    expect(describeDaysSince(120)).toBe("120 days ago");
  });

  it("groups due-soon before lapsed", () => {
    const g = groupByRuleFamily([
      { ruleFamily: "lapsed_reactivation" } as never,
      { ruleFamily: "plan_cadence" } as never
    ]);
    expect(g.map((x) => [x.family, x.items.length])).toEqual([["plan_cadence", 1], ["lapsed_reactivation", 1]]);
  });
});
