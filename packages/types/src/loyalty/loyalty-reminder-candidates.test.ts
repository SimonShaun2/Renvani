import { describe, expect, it } from "vitest";

import {
  buildPlanCadenceLoyaltyCandidates,
  loyaltyEvaluationWindowKey,
  mapM8ReactivationSignalsToLoyaltyCandidates,
  mergeLoyaltyReminderCandidates
} from "./loyalty-reminder-candidates.js";

describe("loyalty-reminder-candidates", () => {
  const customerNames = new Map([
    ["cust-1", "Ada Lovelace"],
    ["cust-2", "Grace Hopper"]
  ]);

  it("builds plan cadence and overdue plan as lapsed_reactivation", () => {
    const candidates = buildPlanCadenceLoyaltyCandidates(
      [
        {
          id: "plan-1",
          customerId: "cust-1",
          propertyId: null,
          name: "Quarterly",
          price: "120.00",
          nextServiceDate: "2026-10-30",
          lastServiceDate: "2026-07-30"
        },
        {
          id: "plan-2",
          customerId: "cust-2",
          propertyId: null,
          name: "Annual",
          price: "400.00",
          nextServiceDate: "2026-10-01",
          lastServiceDate: "2025-10-01"
        }
      ],
      customerNames,
      { horizonDays: 14, asOf: new Date("2026-10-23T12:00:00.000Z"), dryRun: true }
    );

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.ruleFamily).toBe("lapsed_reactivation");
    expect(candidates[0]?.customerId).toBe("cust-2");
    expect(candidates[1]?.ruleFamily).toBe("plan_cadence");
  });

  it("maps M8 reactivation signals and merges without duplicating plan customers", () => {
    const m8 = mapM8ReactivationSignalsToLoyaltyCandidates(
      [
        {
          customerId: "cust-1",
          lastJobId: "job-9",
          lastServiceCompletedAt: "2025-06-01T00:00:00.000Z",
          daysSinceLastService: 140,
          ruleFamily: "lapsed_reactivation",
          importSessionId: "sess-1"
        },
        {
          customerId: "cust-3",
          lastJobId: "job-3",
          lastServiceCompletedAt: "2025-01-01T00:00:00.000Z",
          daysSinceLastService: 300,
          ruleFamily: "lapsed_reactivation",
          importSessionId: "sess-1"
        }
      ],
      new Map([["cust-3", "Alan Turing"]]),
      true
    );

    const plan = buildPlanCadenceLoyaltyCandidates(
      [
        {
          id: "plan-1",
          customerId: "cust-1",
          propertyId: null,
          name: "Quarterly",
          price: null,
          nextServiceDate: "2026-10-30",
          lastServiceDate: null
        }
      ],
      customerNames,
      { horizonDays: 30, asOf: new Date("2026-10-23T12:00:00.000Z"), dryRun: true }
    );

    const merged = mergeLoyaltyReminderCandidates(plan, m8);
    expect(merged.map((row) => row.customerId).sort()).toEqual(["cust-1", "cust-3"]);
  });

  it("builds stable weekly evaluation window keys", () => {
    expect(loyaltyEvaluationWindowKey(new Date("2026-10-23T15:00:00.000Z"))).toMatch(/^2026-W\d+$/);
  });
});
