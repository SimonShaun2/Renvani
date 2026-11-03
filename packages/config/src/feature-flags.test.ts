import { describe, expect, it } from "vitest";

import { isRevenueAgentProposalsEnabled, isWebAssistantEnabled } from "./feature-flags.js";

describe("FS-197 web assistant rollout flag", () => {
  it("fails closed and validates the explicit toggle", () => {
    expect(isWebAssistantEnabled({})).toBe(false);
    expect(isWebAssistantEnabled({ FS197_WEB_ASSISTANT_ENABLED: "false" })).toBe(false);
    expect(isWebAssistantEnabled({ FS197_WEB_ASSISTANT_ENABLED: "true" })).toBe(true);
    expect(() => isWebAssistantEnabled({ FS197_WEB_ASSISTANT_ENABLED: "yes" })).toThrow();
  });
});

describe("Revenue Agent proposal rollout flag", () => {
  it("fails closed by default and accepts explicit enable/disable values", () => {
    expect(isRevenueAgentProposalsEnabled({})).toBe(false);
    expect(isRevenueAgentProposalsEnabled({ REVENUE_AGENT_PROPOSALS_ENABLED: "true" })).toBe(true);
    expect(isRevenueAgentProposalsEnabled({ REVENUE_AGENT_PROPOSALS_ENABLED: "false" })).toBe(false);
  });

  it("rejects invalid flag values", () => {
    expect(() => isRevenueAgentProposalsEnabled({ REVENUE_AGENT_PROPOSALS_ENABLED: "yes" })).toThrow();
  });
});
