import { describe, expect, it, vi } from "vitest";

import { AppError, ErrorCode } from "@fsm/types";

import {
  assertActionAllowedForProduct,
  assertLoyaltyReminderExecutionAllowed,
  requiresHumanApproval
} from "./agent-action.policy.js";

const featureFlagsMock = vi.hoisted(() => ({
  loyaltyRemindersEnabled: true,
  loyaltyRemindersDryRun: false
}));

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: featureFlagsMock
}));
import { LoyaltyReminderProposeParamsV1Schema } from "@fsm/types";

describe("agent-action.policy", () => {
  it("requires approval for outbound send proposals", () => {
    expect(requiresHumanApproval("message.send_proposed")).toBe(true);
    expect(requiresHumanApproval("message.draft")).toBe(false);
  });

  it("allows AI to create send_proposed proposals", () => {
    expect(() =>
      assertActionAllowedForProduct("revenue", "message.send_proposed", "ai")
    ).not.toThrow();
  });

  it("allows AI loyalty reminder proposals", () => {
    expect(() =>
      assertActionAllowedForProduct("loyalty", "loyalty.reminder.propose", "ai")
    ).not.toThrow();
  });

  it("requires approval for loyalty reminder proposals", () => {
    expect(requiresHumanApproval("loyalty.reminder.propose")).toBe(true);
  });

  it("allows system service job brief proposals", () => {
    expect(() =>
      assertActionAllowedForProduct("service", "service.job_brief.propose", "system")
    ).not.toThrow();
    expect(requiresHumanApproval("service.job_brief.propose")).toBe(true);
  });

  it("parses loyalty.reminder.propose FS-12 parameters", () => {
    const parsed = LoyaltyReminderProposeParamsV1Schema.parse({
      customerId: "11111111-1111-4111-8111-111111111111",
      ruleFamily: "plan_cadence",
      maintenancePlanId: "22222222-2222-4222-8222-222222222222",
      summary: "Quarterly plan visit due"
    });
    expect(parsed.ruleFamily).toBe("plan_cadence");
  });

  it("blocks loyalty execution while dry-run is enabled", () => {
    featureFlagsMock.loyaltyRemindersEnabled = true;
    featureFlagsMock.loyaltyRemindersDryRun = true;

    expect(() => assertLoyaltyReminderExecutionAllowed()).toThrow(AppError);
  });

  it("denies unknown revenue tools", () => {
    try {
      assertActionAllowedForProduct("revenue", "invoice.charge", "user");
      expect.fail("expected policy error");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ErrorCode.POLICY_DENIED);
    }
  });
});
