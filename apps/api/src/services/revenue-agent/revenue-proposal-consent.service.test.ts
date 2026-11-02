import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAgentActionMock, authorizeMock } = vi.hoisted(() => ({
  getAgentActionMock: vi.fn(),
  authorizeMock: vi.fn()
}));

vi.mock("../agent-action.service.js", () => ({ getAgentAction: getAgentActionMock }));
vi.mock("../outbound-policy-engine.service.js", () => ({ authorizeAgentActionExecution: authorizeMock }));

import { checkRevenueProposalConsent } from "./revenue-proposal-consent.service.js";

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const actionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: actionId,
    companyId,
    actionType: "revenue.reactivation.propose",
    parameters: { channel: "sms", consentScope: "marketing" },
    approvedParameters: null,
    target: { companyId, entityType: "customer", entityId: "c1" },
    requiresApproval: true,
    state: "awaiting_approval",
    ...overrides
  };
}

describe("checkRevenueProposalConsent", () => {
  beforeEach(() => {
    getAgentActionMock.mockReset();
    authorizeMock.mockReset();
  });

  it("reports a consent-blocked proposal without sending", async () => {
    getAgentActionMock.mockResolvedValue(action());
    authorizeMock.mockResolvedValue({ allowed: false, policyVersion: "v1", reason: "No marketing opt-in", failureCode: "consent_missing" });

    const result = await checkRevenueProposalConsent(companyId, "u1", actionId);

    expect(getAgentActionMock).toHaveBeenCalledWith(companyId, actionId);
    expect(authorizeMock).toHaveBeenCalledWith(expect.objectContaining({ companyId, state: "approved" }));
    expect(result).toMatchObject({ blocked: true, allowed: false, channel: "sms", consentScope: "marketing", failureCode: "consent_missing" });
  });

  it("uses the operator-edited channel when present", async () => {
    getAgentActionMock.mockResolvedValue(action({ approvedParameters: { channel: "email", consentScope: "appointment" } }));
    authorizeMock.mockResolvedValue({ allowed: true, policyVersion: "v1", reason: "ok" });

    const result = await checkRevenueProposalConsent(companyId, "u1", actionId);

    expect(result).toMatchObject({ allowed: true, blocked: false, channel: "email", consentScope: "appointment", failureCode: null });
  });

  it("does not expose non-revenue actions", async () => {
    getAgentActionMock.mockResolvedValue(action({ actionType: "loyalty.reminder.propose" }));
    await expect(checkRevenueProposalConsent(companyId, "u1", actionId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(authorizeMock).not.toHaveBeenCalled();
  });
});
