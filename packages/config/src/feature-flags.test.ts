import { describe, expect, it } from "vitest";

import { isRevenueAgentProposalsEnabled } from "./feature-flags.js";

describe("Revenue Agent proposal rollout flag", () => {
  it("defaults to the currently integrated behavior and accepts explicit enable/disable values", () => {
    expect(isRevenueAgentProposalsEnabled({})).toBe(true);
    expect(isRevenueAgentProposalsEnabled({ REVENUE_AGENT_PROPOSALS_ENABLED: "true" })).toBe(true);
    expect(isRevenueAgentProposalsEnabled({ REVENUE_AGENT_PROPOSALS_ENABLED: "false" })).toBe(false);
  });

  it("rejects invalid flag values", () => {
    expect(() => isRevenueAgentProposalsEnabled({ REVENUE_AGENT_PROPOSALS_ENABLED: "yes" })).toThrow();
  });
});
