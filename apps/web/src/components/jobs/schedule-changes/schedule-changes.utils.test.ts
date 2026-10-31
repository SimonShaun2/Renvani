import { describe, expect, it } from "vitest";

import { ErrorCode } from "@fsm/types";

import { ApiError } from "@/src/lib/api";

import { canManageSchedule, cancelBlockedReason, describeChange, describeScheduleError, isWithinCancellationWindow } from "./schedule-changes.utils";

const now = new Date("2026-11-02T15:00:00.000Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();

describe("schedule change gating", () => {
  it("only owner/admin/dispatcher can manage schedules, same as the API", () => {
    expect(["owner", "admin", "dispatcher"].map(canManageSchedule)).toEqual([true, true, true]);
    expect(["technician", "viewer", null, undefined].map(canManageSchedule)).toEqual([false, false, false, false]);
  });

  it("uses the same 24h window as the API (start - now < 24h)", () => {
    expect(isWithinCancellationWindow(inHours(23.9), now)).toBe(true);
    expect(isWithinCancellationWindow(inHours(24), now)).toBe(false);
    expect(isWithinCancellationWindow(inHours(-1), now)).toBe(true);
    expect(isWithinCancellationWindow(null, now)).toBe(false);
  });

  it("blocks dispatchers inside the window with an explanation, never owner/admin", () => {
    expect(cancelBlockedReason("dispatcher", inHours(3), now)).toMatch(/owner or admin/);
    expect(cancelBlockedReason("owner", inHours(3), now)).toBeNull();
    expect(cancelBlockedReason("admin", inHours(3), now)).toBeNull();
    expect(cancelBlockedReason("dispatcher", inHours(48), now)).toBeNull();
  });
});

describe("describeScheduleError", () => {
  const err = (status: number, code: ErrorCode, fields: Record<string, string>) => new ApiError(status, { error: code, message: "msg", fields });

  it("409s offer a reload", () => {
    expect(describeScheduleError(err(409, ErrorCode.CONFLICT, { reason: "stale_version", currentVersion: "3" }))).toMatchObject({ kind: "stale", reload: true });
    expect(describeScheduleError(err(409, ErrorCode.CONFLICT, { reason: "idempotency_conflict" }))).toMatchObject({ kind: "idempotency", reload: true });
    expect(describeScheduleError(err(409, ErrorCode.CONFLICT, { reason: "schedule_conflict", conflictJobId: "j9" }))).toMatchObject({
      kind: "conflict",
      reload: true,
      conflictJobId: "j9"
    });
  });

  it("403 cancellation_window is not a reload case", () => {
    expect(describeScheduleError(err(403, ErrorCode.POLICY_DENIED, { reason: "cancellation_window", windowHours: "24" }))).toMatchObject({ kind: "window", reload: false });
  });

  it("handles unknown errors", () => {
    expect(describeScheduleError(new Error("x")).kind).toBe("other");
  });
});

it("labels exceptions as flagged for a person", () => {
  expect(
    describeChange({
      id: "c1",
      action: "exception",
      version: 2,
      actorUserId: "u1",
      reason: "late",
      previous: { status: "scheduled", technicianId: null, scheduledStart: null, scheduledEnd: null },
      next: { status: "scheduled", technicianId: null, scheduledStart: null, scheduledEnd: null },
      exception: { kind: "late_staff", delayMinutes: 30, escalation: "human" },
      occurredAt: now.toISOString()
    })
  ).toBe("Flagged for a person: Tech running late (30 min)");
});
