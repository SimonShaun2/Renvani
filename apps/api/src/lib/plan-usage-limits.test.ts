import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@fsm/db", () => ({
  db: {},
  automationRules: { companyId: "company_id", isEnabled: "is_enabled", deletedAt: "deleted_at" },
  companies: { id: "id", settings: "settings", deletedAt: "deleted_at" },
  jobs: { companyId: "company_id", deletedAt: "deleted_at" }
}));

import { RENVANI_PLAN_USAGE_ENTITLEMENTS } from "@fsm/config/renvani-plan-entitlements";

import {
  assertPlanAllowsAutomationEnable,
  assertPlanAllowsJobCreation,
  enforceAutomationEnablePlanLimit,
  enforceJobCreationPlanLimit
} from "./plan-usage-limits.js";

type Executor = Parameters<typeof enforceJobCreationPlanLimit>[1];

/** Fake executor: first select returns the company row, later selects return a count row. */
function makeExecutor(countValue: number) {
  const results: unknown[][] = [[{ settings: {} }], [{ value: countValue }]];
  const select = vi.fn(() => {
    const result = results.shift() ?? [];
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => Object.assign(Promise.resolve(result), chain);
    chain.limit = () => Promise.resolve(result);
    return chain;
  });
  return { executor: { select } as unknown as Executor, select };
}

const startup = RENVANI_PLAN_USAGE_ENTITLEMENTS.startup;
const original = { ...startup };

afterEach(() => {
  startup.maxJobs = original.maxJobs;
  startup.maxAutomations = original.maxAutomations;
});

describe("plan usage limit enforcement (FS-136)", () => {
  it("skips the count query when jobs are unlimited", async () => {
    const { executor, select } = makeExecutor(9999);
    await expect(enforceJobCreationPlanLimit("c1", executor)).resolves.toBeUndefined();
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("skips the count query when automations are unlimited", async () => {
    const { executor, select } = makeExecutor(9999);
    await expect(enforceAutomationEnablePlanLimit("c1", executor)).resolves.toBeUndefined();
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("counts through the given executor and blocks job creation at the cap", async () => {
    startup.maxJobs = 2;
    const under = makeExecutor(1);
    await expect(enforceJobCreationPlanLimit("c1", under.executor)).resolves.toBeUndefined();
    expect(under.select).toHaveBeenCalledTimes(2);
    const at = makeExecutor(2);
    await expect(enforceJobCreationPlanLimit("c1", at.executor)).rejects.toThrow(
      /plan limit for jobs has been reached/
    );
  });

  it("blocks enabling automations at the cap", async () => {
    startup.maxAutomations = 1;
    const { executor } = makeExecutor(1);
    await expect(enforceAutomationEnablePlanLimit("c1", executor)).rejects.toThrow(
      /plan limit for automations has been reached/
    );
  });

  it("pure asserts allow unlimited and reject at a finite cap", () => {
    expect(() => assertPlanAllowsJobCreation(null, 1_000_000)).not.toThrow();
    startup.maxJobs = 0;
    startup.maxAutomations = 0;
    expect(() => assertPlanAllowsJobCreation(null, 0)).toThrow(/Upgrade your plan/);
    expect(() => assertPlanAllowsAutomationEnable(null, 0)).toThrow(/Upgrade your plan/);
  });
});
