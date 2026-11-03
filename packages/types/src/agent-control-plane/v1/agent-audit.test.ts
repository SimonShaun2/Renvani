import { describe, expect, it } from "vitest";

import { buildAgentActivityAuditPayloadV1 } from "./agent-audit.js";

describe("buildAgentActivityAuditPayloadV1", () => {
  it("builds a versioned audit envelope with FS-72 gate flags", () => {
    const payload = buildAgentActivityAuditPayloadV1({
      lifecycle: "proposal_created",
      policyVersion: "agent-policy-v1",
      agentProduct: "retention",
      actionType: "loyalty.reminder.propose",
      requiresApproval: true,
      agentActionId: "00000000-0000-4000-8000-000000000099",
      loyaltyRemindersDryRun: true,
      loyaltyRemindersEnabled: false,
      detail: { state: "awaiting_approval" }
    });

    expect(payload.auditSchemaVersion).toBe("agent-activity-audit-v1");
    expect(payload.loyaltyRemindersDryRun).toBe(true);
    expect(payload.detail).toEqual({ state: "awaiting_approval" });
  });
});
