import { describe, expect, it, vi } from "vitest";

const { evaluateMock, featureFlagsMock } = vi.hoisted(() => ({
  evaluateMock: vi.fn(async () => [
    {
      ruleFamily: "plan_cadence" as const,
      customerId: "cust-1",
      customerName: "Ada",
      maintenancePlanId: "plan-1",
      evidenceJobId: null,
      importSessionId: null,
      planName: "Quarterly",
      nextServiceDate: "2026-10-30",
      lastServiceDate: null,
      daysUntilDue: 7,
      daysSinceLastService: null,
      dryRun: true
    }
  ]),
  featureFlagsMock: {
    loyaltyRemindersEnabled: false,
    loyaltyRemindersDryRun: true
  }
}));

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: featureFlagsMock
}));

vi.mock("@fsm/db", () => ({
  evaluateLoyaltyReminderCandidatesForCompany: evaluateMock
}));

import { listLoyaltyReminderCandidates } from "./loyalty-reminder-candidates.service.js";

describe("loyalty-reminder-candidates.service", () => {
  it("returns empty when loyalty reminders feature flag is disabled", async () => {
    const result = await listLoyaltyReminderCandidates("company-1", { horizonDays: 14 });
    expect(result).toEqual({ candidates: [], dryRun: true });
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it("delegates evaluation when feature flag is enabled", async () => {
    featureFlagsMock.loyaltyRemindersEnabled = true;

    const result = await listLoyaltyReminderCandidates("company-1", {
      horizonDays: 21,
      importSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      lapsedDays: 60
    });

    expect(evaluateMock).toHaveBeenCalledWith("company-1", {
      horizonDays: 21,
      importSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      lapsedDays: 60,
      dryRun: true
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.dryRun).toBe(true);

    featureFlagsMock.loyaltyRemindersEnabled = false;
  });
});
