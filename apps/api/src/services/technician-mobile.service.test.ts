import { describe, expect, it, vi } from "vitest";

vi.mock("@fsm/db", () => ({ db: {}, emitEventWithExecutor: vi.fn(), jobs: {}, jobTasks: {}, onTheWayNotifications: {}, technicians: {}, users: {} }));
vi.mock("./job.service.js", () => ({ addNote: vi.fn(), transitionStatus: vi.fn() }));
vi.mock("./job-tasks.service.js", () => ({ updateTask: vi.fn() }));

const svc = await import("./technician-mobile.service.js");

describe("technician-mobile service helpers", () => {
  it("orders by scheduledStart then jobNumber, unscheduled last", () => {
    const mk = (jobNumber: string, at: string | null) => ({ jobNumber, scheduledStart: at ? new Date(at) : null }) as never;
    const rows = [mk("J3", null), mk("J2", "2026-10-27T15:00:00Z"), mk("J1", "2026-10-27T15:00:00Z"), mk("J0", "2026-10-27T09:00:00Z")];
    expect(rows.sort(svc.compareRouteOrder).map((r: { jobNumber: string }) => r.jobNumber)).toEqual(["J0", "J1", "J2", "J3"]);
  });

  it("utcDayBounds returns a 24h UTC window and defaults to today", () => {
    const b = svc.utcDayBounds("2026-10-27");
    expect(b.start.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-10-28T00:00:00.000Z");
    expect(svc.utcDayBounds(undefined, new Date("2026-01-02T05:00:00Z")).day).toBe("2026-01-02");
  });

  it("formats issue notes with category and severity", () => {
    expect(svc.formatIssueNote({ category: "safety", severity: "high", description: "Gas smell" })).toBe("[ISSUE safety/high] Gas smell");
  });
});
