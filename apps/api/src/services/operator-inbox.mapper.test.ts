import { describe, expect, it } from "vitest";

import {
  extractProposedContent,
  extractRecipient,
  resolveOverridePaths,
  resolveRiskLevel,
  toOperatorInboxItem,
  type AgentActionRowView
} from "./operator-inbox.mapper.js";

const baseRow: AgentActionRowView = {
  id: "11111111-1111-4111-8111-111111111111",
  agentProduct: "revenue",
  actionType: "message.send_proposed",
  parameters: {
    channel: "sms",
    body: "Hello there",
    recipient: { firstName: "Ada", lastName: "Lovelace", phone: "+15555550123" }
  },
  approvedParameters: null,
  sourceEventIds: [],
  policyVersion: "agent-policy-v1",
  requiresApproval: true,
  state: "awaiting_approval",
  confidence: "0.82",
  reason: "High intent inquiry",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  reviewerId: null,
  executionReceipt: null,
  createdAt: new Date().toISOString()
};

describe("operator-inbox.mapper", () => {
  it("marks send proposals as high risk", () => {
    expect(resolveRiskLevel("message.send_proposed")).toBe("high");
  });

  it("exposes edit/approve/reject while awaiting approval", () => {
    expect(resolveOverridePaths("awaiting_approval", true)).toEqual(["reject", "edit", "approve", "escalate"]);
  });

  it("maps recipient and proposed content from parameters", () => {
    expect(extractRecipient(baseRow.parameters).displayName).toBe("Ada Lovelace");
    expect(extractProposedContent(baseRow.parameters).body).toBe("Hello there");
  });

  it("prefers approved parameters for inbox display after approval", () => {
    const item = toOperatorInboxItem(
      {
        ...baseRow,
        state: "approved",
        approvedParameters: {
          channel: "sms",
          body: "Operator edited copy",
          recipient: { firstName: "Ada", lastName: "Lovelace", phone: "+15555550123" }
        }
      },
      []
    );

    expect(item.proposedContent.body).toBe("Operator edited copy");
    expect(item.overridePaths).toContain("execute");
  });
});
