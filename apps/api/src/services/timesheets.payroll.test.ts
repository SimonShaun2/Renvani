/**
 * FS-171 — pure payroll math (overtime split, rounding, rate lookup, CSV).
 */
import { describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

vi.mock("@fsm/db", async () => (await import("../test-support/fake-db.js")).createDbModuleMock());
vi.mock("drizzle-orm", async () => (await import("../test-support/fake-db.js")).createDrizzleModuleMock());

const {
  localDate,
  payrollToCsv,
  rateForDate,
  splitWeeklyOvertime,
  workweekStart,
} = await import("./timesheets.service.js");
type PayrollWorkItem = import("./timesheets.service.js").PayrollWorkItem;

function day(date: string, hours: number, rateCents: number | null = 2000, hour = 14): PayrollWorkItem {
  return { workDate: date, startedAt: new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`), minutes: hours * 60, rateCents };
}

describe("timesheets payroll math", () => {
  it("workweek starts Monday; local date honours company timezone", () => {
    expect(workweekStart("2026-10-25")).toBe("2026-10-19"); // Sunday -> Monday
    expect(workweekStart("2026-10-19")).toBe("2026-10-19");
    expect(localDate(new Date("2026-10-20T03:00:00Z"), "America/Chicago")).toBe("2026-10-19");
  });

  it("no overtime at exactly 40h", () => {
    const split = splitWeeklyOvertime(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((d) => day(d, 8)));
    expect(split).toMatchObject({ regularMinutes: 2400, overtimeMinutes: 0, regularPayCents: 80000, overtimePayCents: 0 });
  });

  it("weekly >40h at 1.5x; overtime is the minutes after the threshold", () => {
    const items = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((d) => day(d, 9));
    const split = splitWeeklyOvertime(items);
    expect(split.regularMinutes).toBe(2400);
    expect(split.overtimeMinutes).toBe(300);
    expect(split.regularPayCents).toBe(80000); // 40h x $20
    expect(split.overtimePayCents).toBe(15000); // 5h x $30
  });

  it("weeks are independent (no overtime carry-over across Monday)", () => {
    const items = [
      ...["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map((d) => day(d, 10)),
      ...["2026-10-26", "2026-10-27"].map((d) => day(d, 10))
    ];
    expect(splitWeeklyOvertime(items)).toMatchObject({ regularMinutes: 3600, overtimeMinutes: 0 });
  });

  it("configurable threshold and multiplier", () => {
    const split = splitWeeklyOvertime([day("2026-10-19", 10)], 480, 20000);
    expect(split).toMatchObject({ regularMinutes: 480, overtimeMinutes: 120, regularPayCents: 16000, overtimePayCents: 8000 });
  });

  it("rounds once per bucket to whole cents, half-up", () => {
    // 1 minute at $10.01/h = 16.6833c -> 17c ; 3 x that minute summed exactly = 50.05 -> 50c
    expect(splitWeeklyOvertime([{ ...day("2026-10-19", 0, 1001), minutes: 1 }]).regularPayCents).toBe(17);
    expect(splitWeeklyOvertime([1, 2, 3].map((h) => ({ ...day("2026-10-19", 0, 1001, 10 + h), minutes: 1 }))).regularPayCents).toBe(50);
  });

  it("uses the rate effective on each work date and flags missing rates", () => {
    const rates = [{ effectiveFrom: "2026-10-01", hourlyRateCents: 2000 }, { effectiveFrom: "2026-10-21", hourlyRateCents: 2500 }];
    expect(rateForDate(rates, "2026-10-20")).toBe(2000);
    expect(rateForDate(rates, "2026-10-21")).toBe(2500);
    expect(rateForDate(rates, "2026-09-30")).toBeNull();
    expect(splitWeeklyOvertime([day("2026-10-19", 8, null)])).toMatchObject({ missingPayRate: true, regularPayCents: null, regularMinutes: 480 });
  });

  it("CSV export has a header, dollar amounts and formula-injection guard", () => {
    const csv = payrollToCsv({
      contractVersion: "1.0.0", periodStart: "2026-10-19", periodEnd: "2026-10-25", timezone: "America/Chicago",
      weeklyOvertimeThresholdMinutes: 2400, overtimeMultiplierBps: 15000,
      lines: [{
        technicianId: "t1", technicianName: "=HYPERLINK(\"x\")", timesheetIds: ["s1"], regularMinutes: 2400, overtimeMinutes: 300,
        totalMinutes: 2700, hourlyRateCents: 2000, regularPayCents: 80000, overtimePayCents: 15000, grossPayCents: 95000, missingPayRate: false
      }],
      totals: { regularMinutes: 2400, overtimeMinutes: 300, totalMinutes: 2700, grossPayCents: 95000 }
    });
    const [header, row] = csv.trim().split("\r\n");
    expect(header).toContain("regular_hours,overtime_hours");
    expect(row).toContain("40.00,5.00,45.00");
    expect(row).toContain("950.00");
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
