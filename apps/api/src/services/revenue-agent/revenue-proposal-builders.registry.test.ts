import { describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", async () => (await import("../../test-support/fake-db.js")).createDrizzleModuleMock());
vi.mock("@fsm/db", async () => (await import("../../test-support/fake-db.js")).createDbModuleMock());
vi.mock("@fsm/jobs", () => ({ redisConnection: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

import { getAgentActionTypeDefinition, registerAgentActionType } from "../agent-action.registry.js";
import { assertActionAllowedForProduct } from "../agent-action.policy.js";
import { resolveConsequences, resolveRiskLevel } from "../operator-inbox.mapper.js";
import {
  getRevenueProposalBuilder,
  registerRevenueProposalBuilder,
  unregisterRevenueProposalBuilder
} from "./revenue-proposal-builders.registry.js";
import "./revenue-proposal.kinds.js";

describe("revenue proposal registry", () => {
  it("registers the built-in kinds from recommendation types", () => {
    for (const [type, action] of [
      ["unpaid_invoice", "revenue.invoice_reminder.propose"],
      ["unsold_estimate", "revenue.estimate_followup.propose"],
      ["reactivation", "revenue.reactivation.propose"],
      ["maintenance_plan_offer", "revenue.plan_offer.propose"]
    ] as const) {
      expect(getRevenueProposalBuilder(type)?.actionType).toBe(action);
      const def = getAgentActionTypeDefinition(action);
      expect(def).toMatchObject({ agentProduct: "revenue", aiMayPropose: true, risk: "high", fromRecommendationType: type });
      expect(resolveRiskLevel(action)).toBe("high");
    }
  });

  it("returns undefined for unknown types and supports override", () => {
    expect(getRevenueProposalBuilder("aging_asset")).toBeUndefined();
    const original = getRevenueProposalBuilder("reactivation")!;
    registerRevenueProposalBuilder({ ...original, actionType: "revenue.custom.propose" });
    expect(getRevenueProposalBuilder("reactivation")?.actionType).toBe("revenue.custom.propose");
    registerRevenueProposalBuilder(original);
    unregisterRevenueProposalBuilder("does_not_exist");
    expect(() => registerRevenueProposalBuilder({ ...original, recommendationType: "Bad Type" })).toThrow();
  });

  it("keeps operator-inbox risk/consequences for existing kinds and reads overrides from the registry", () => {
    expect(resolveRiskLevel("message.send_proposed")).toBe("high");
    expect(resolveRiskLevel("message.draft")).toBe("medium");
    expect(resolveRiskLevel("loyalty.reminder.propose")).toBe("medium");
    expect(resolveRiskLevel("scheduling.booking.self_service")).toBe("medium");
    expect(resolveRiskLevel("service.job_brief.propose")).toBe("low");
    expect(resolveRiskLevel("unknown.kind")).toBe("low");
    expect(resolveConsequences("message.draft")).toEqual([
      "Saves a draft proposal for later review; nothing is sent to the customer."
    ]);
    expect(resolveConsequences("loyalty.reminder.propose")).toEqual([
      "Applies the proposed agent action according to policy."
    ]);
    expect(resolveConsequences("unknown.kind")).toEqual(["Applies the proposed agent action according to policy."]);

    registerAgentActionType({ actionType: "revenue.test.override", agentProduct: "revenue", risk: "medium", consequences: ["X"] });
    expect(resolveRiskLevel("revenue.test.override")).toBe("medium");
    expect(resolveConsequences("revenue.test.override")).toEqual(["X"]);
  });

  it("denies AI proposals for revenue kinds that are not aiMayPropose", () => {
    registerAgentActionType({ actionType: "revenue.test.manual_only", agentProduct: "revenue" });
    expect(() => assertActionAllowedForProduct("revenue", "revenue.test.manual_only", "ai")).toThrow();
    expect(() => assertActionAllowedForProduct("revenue", "revenue.invoice_reminder.propose", "ai")).not.toThrow();
  });
});
