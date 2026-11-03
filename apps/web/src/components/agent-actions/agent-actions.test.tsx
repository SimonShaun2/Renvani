import { AgentActionStateV1Schema } from "@fsm/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { OperatorInboxItem } from "@fsm/types";

vi.mock("@/src/hooks/operator-inbox.hooks", () => {
  const m = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
  useApproveAgentAction: m,
  useRejectAgentAction: m,
  useExecuteAgentAction: m,
  useEditOperatorInboxItem: m
  };
});

import { AgentActionPanel } from "./AgentActionPanel";
import { INBOX_TABS, agentActionsFor, agentProducts, receiptRows } from "./agent-actions.config";

const item = (over: Partial<OperatorInboxItem> = {}): OperatorInboxItem => ({
  contractVersion: "0.1.0",
  id: "11111111-1111-4111-8111-111111111111",
  state: "awaiting_approval",
  risk: "medium",
  recipient: { displayName: "Leah Moore" },
  proposedContent: { channel: "email", subject: "Your tune-up", body: "Hi Leah" },
  consequences: ["Sends one email"],
  expiresAt: "2026-10-30T12:00:00.000Z",
  overridePaths: ["approve", "reject", "edit", "execute"],
  requiresApproval: true,
  provenance: {
    agentProduct: "service",
    actionType: "service.job_brief.propose",
    sourceEventIds: [],
    sourceEvents: [],
    createdAt: "2026-10-27T12:00:00.000Z",
    policyVersion: "v1"
  },
  ...over
});

describe("agent action registry", () => {
  it("offers approve/edit/reject while awaiting approval, execute once approved", () => {
    expect(agentActionsFor(item()).map((a) => a.key)).toEqual(["approve", "edit", "reject"]);
    expect(agentActionsFor(item({ state: "approved" })).map((a) => a.key)).toEqual(["execute"]);
    expect(agentActionsFor(item({ state: "succeeded" }))).toEqual([]);
  });
  it("respects overridePaths", () => {
    expect(agentActionsFor(item({ overridePaths: ["reject"] })).map((a) => a.key)).toEqual(["reject"]);
  });
  it("tabs use real AgentActionStateV1 values: Queued · not sent = executing, Completed = succeeded, Rejected = cancelled", () => {
    expect(INBOX_TABS.map((t) => [t.key, t.label])).toEqual([
      ["awaiting_approval", "Needs approval"],
      ["approved", "Ready to execute"],
      ["executing", "Queued · not sent"],
      ["failed", "Failed"],
      ["expired", "Expired"],
      ["succeeded", "Completed"],
      ["cancelled", "Rejected"]
    ]);
    for (const t of INBOX_TABS) expect(AgentActionStateV1Schema.safeParse(t.key).success).toBe(true);
  });
  it("flattens receipts and lists agents", () => {
    expect(receiptRows({ providerMessageId: "m_1", dryRun: false, meta: { a: 1 } })).toEqual([
      ["provider Message Id", "m_1"],
      ["dry Run", "false"],
      ["meta", '{"a":1}']
    ]);
    expect(receiptRows(null)).toEqual([]);
    expect(agentProducts([item(), item({ provenance: { ...item().provenance, agentProduct: "revenue_agent" } })])).toEqual(["revenue_agent", "service"]);
  });
});

describe("AgentActionPanel", () => {
  it("renders actions for a non-revenue item", () => {
    const html = renderToStaticMarkup(<AgentActionPanel item={item()} />);
    expect(html).toContain('data-agent-action="approve"');
    expect(html).toContain('data-agent-action="reject"');
    expect(html).toContain('data-agent-action="edit"');
  });
  it("renders execute and the receipt for approved/executed items", () => {
    expect(renderToStaticMarkup(<AgentActionPanel item={item({ state: "approved" })} />)).toContain('data-agent-action="execute"');
    const done = renderToStaticMarkup(<AgentActionPanel item={item({ state: "succeeded", executionReceipt: { providerMessageId: "m_1" } })} />);
    expect(done).toContain("Execution receipt");
    expect(done).toContain("m_1");
    expect(done).not.toContain("data-agent-action");
  });
});
