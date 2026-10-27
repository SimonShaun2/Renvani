// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import {
  BOOKING_CONFIRMED_SESSION_PREFIX,
  buildRecurringScheduleMessage,
  readConfirmedBookingSnapshot,
  saveConfirmedBookingSnapshot,
  suggestsRecurringServiceIntent
} from "@/src/lib/booking-commit.utils";

describe("booking commit utils", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("detects recurring service intent from booking fields", () => {
    expect(
      suggestsRecurringServiceIntent({
        serviceType: "Monthly maintenance"
      })
    ).toBe(true);
    expect(
      suggestsRecurringServiceIntent({
        serviceDetail: "VIP tune-up"
      })
    ).toBe(true);
    expect(
      suggestsRecurringServiceIntent({
        serviceType: "Repair"
      })
    ).toBe(false);
  });

  it("builds recurring schedule messaging from API payload", () => {
    expect(
      buildRecurringScheduleMessage({
        linked: true,
        scheduleKind: "maintenance",
        maintenancePlanId: "plan-1",
        maintenanceVisitId: "visit-1"
      })
    ).toContain("maintenance plan");

    expect(
      buildRecurringScheduleMessage({
        linked: false,
        scheduleKind: "vip",
        maintenancePlanId: null,
        maintenanceVisitId: null
      })
    ).toContain("VIP");
  });

  it("persists confirmed booking snapshot in session storage", () => {
    saveConfirmedBookingSnapshot("acme", "BK-123", {
      status: "confirmed",
      jobId: "job-1",
      recurringSchedule: {
        linked: false,
        scheduleKind: "none",
        maintenancePlanId: null,
        maintenanceVisitId: null
      },
      scheduledStart: "2026-05-12T13:00:00.000Z",
      scheduledEnd: "2026-05-12T15:00:00.000Z"
    });

    expect(sessionStorage.getItem(`${BOOKING_CONFIRMED_SESSION_PREFIX}acme:BK-123`)).toBeTruthy();
    expect(readConfirmedBookingSnapshot("acme", "BK-123")?.jobId).toBe("job-1");
  });
});
