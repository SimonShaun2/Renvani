import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { OperatorInboxItem } from "@fsm/types";

import { AgentProposalCard } from "./AgentProposalCard";
import { ProposalDetail } from "./ProposalDetail";
import { availableActions, consentBlockedCopy, isRevenueProposal, proposalTypeConfig } from "./proposal.config";

const item = (over: Partial<OperatorInboxItem> = {}): OperatorInboxItem => ({
  contractVersion: "0.1.0",
  id: "11111111-1111-4111-8111-111111111111",
  state: "awaiting_approval",
  risk: "high",
  recipient: { displayName: "Dana Whitfield" },
  proposedContent: { channel: "sms", body: "Hi Dana, still want that tune-up?" },
  consequences: ["Sends one SMS"],
  expiresAt: "2026-10-30T12:00:00.000Z",
  overridePaths: ["approve", "reject", "edit"],
  requiresApproval: true,
  provenance: {
    agentProduct: "revenue_agent",
    actionType: "revenue.estimate_followup.propose",
    sourceEventIds: [],
    sourceEvents: [],
    createdAt: "2026-10-27T12:00:00.000Z",
    reason: "Estimate sent 6 days ago",
    policyVersion: "v1"
  },
  ...over
});

describe("proposal.config", () => {
  it("recognises revenue action types and maps labels", () => {
    expect(isRevenueProposal("revenue.plan_offer.propose")).toBe(true);
    expect(isRevenueProposal("dispatch.assign")).toBe(false);
    expect(proposalTypeConfig("revenue.estimate_followup.propose").label).toBe("Revenue · Follow-up");
    expect(proposalTypeConfig("revenue.plan_offer.propose").label).toBe("Retention · Recurring offer");
    expect(proposalTypeConfig("revenue.reactivation.propose").label).toBe("Retention · Win-back");
  });

  it("only offers actions the API allows", () => {
    expect(availableActions(item({ overridePaths: ["reject"] })).map((a) => a.key)).toEqual(["reject"]);
  });

  it("builds Figma 10:372 consent-blocked copy", () => {
    expect(consentBlockedCopy("Leah Moore", "email")).toEqual({
      status: "Consent blocked",
      message: "Can’t send: Leah hasn’t opted in to email. Email opt-in missing.",
      request: "Request email consent",
      dismiss: "Dismiss"
    });
    expect(consentBlockedCopy("Tom Becker", "sms").request).toBe("Request text consent");
  });
});

describe("AgentProposalCard / ProposalDetail", () => {
  it("renders Figma 10:309 card copy and actions", () => {
    const html = renderToStaticMarkup(<AgentProposalCard item={item()} onAction={() => {}} />);
    expect(html).toContain("Needs approval");
    expect(html).toContain("Revenue · Follow-up");
    expect(html).toContain("Approve &amp; send");
    expect(html).toContain("Reject");
  });

  it("renders the consent-blocked state instead of approve/edit", () => {
    const html = renderToStaticMarkup(
      <AgentProposalCard item={item({ recipient: { displayName: "Leah Moore" } })} onAction={() => {}} consentBlocked={{ channel: "email" }} onDismiss={() => {}} />
    );
    expect(html).toContain("Consent blocked");
    expect(html).toContain("Can’t send: Leah hasn’t opted in to email. Email opt-in missing.");
    expect(html).toContain("Request email consent");
    expect(html).toContain("Dismiss");
    expect(html).not.toContain("Approve &amp; send");
  });

  it("renders — for fields with no API", () => {
    const html = renderToStaticMarkup(<ProposalDetail item={item()} />);
    expect(html).toContain("What happens if you approve");
    expect(html).toContain("Price rule");
    expect(html).toContain("—");
  });
});
