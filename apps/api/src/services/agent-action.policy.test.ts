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

describe("agent-action registry (FS-25 follow-up)", () => {
  it("adds a new action type and product by registering, without policy edits", async () => {
    const { registerAgentActionType, registerAgentProduct } = await import("./agent-action.registry.js");
    registerAgentProduct({
      agentProduct: "test_addon",
      assertActorAllowed: (_definition, actorType) => {
        if (actorType !== "system") {
          throw new AppError(ErrorCode.POLICY_DENIED, "system only");
        }
      }
    });
    registerAgentActionType({ actionType: "test_addon.ping", agentProduct: "test_addon", autoApproved: true });

    expect(() => assertActionAllowedForProduct("test_addon", "test_addon.ping", "system")).not.toThrow();
    expect(() => assertActionAllowedForProduct("test_addon", "test_addon.ping", "user")).toThrow(AppError);
    expect(requiresHumanApproval("test_addon.ping")).toBe(false);
    // Registered type is scoped to its own product.
    expect(() => assertActionAllowedForProduct("revenue", "test_addon.ping", "user")).toThrow(AppError);
  });

  it("keeps built-in behavior: approvals, editability, unknown product and AI gating", async () => {
    const { isAgentActionEditable } = await import("./agent-action.policy.js");
    for (const type of [
      "message.send_proposed",
      "loyalty.reminder.propose",
      "service.job_brief.propose",
      "scheduling.booking.self_service",
      "revenue.inquiry.qualify",
      "unknown.type"
    ]) {
      expect(requiresHumanApproval(type)).toBe(true);
    }
    expect(requiresHumanApproval("context.resolve")).toBe(false);
    expect(isAgentActionEditable("message.draft")).toBe(true);
    expect(isAgentActionEditable("message.send_proposed")).toBe(true);
    expect(isAgentActionEditable("service.job_brief.propose")).toBe(false);
    expect(() => assertActionAllowedForProduct("retention", "context.resolve", "user")).toThrow(
      "Agent product is not enabled"
    );
    expect(() => assertActionAllowedForProduct("revenue", "context.resolve", "ai")).not.toThrow();
    expect(() => assertActionAllowedForProduct("loyalty", "loyalty.reminder.propose", "user")).toThrow(
      "Only AI may propose loyalty reminder actions in v1"
    );
    expect(() => assertActionAllowedForProduct("service", "service.job_brief.propose", "user")).toThrow(
      "Only automated service agents may propose job brief actions in v1"
    );
    expect(() =>
      assertActionAllowedForProduct("scheduling", "scheduling.booking.self_service", "ai")
    ).toThrow("Scheduling self-service notices require a system actor");
    expect(() => assertActionAllowedForProduct("service", "loyalty.reminder.propose", "ai")).toThrow(
      "Action type is not allowed for service agent"
    );
  });
});
