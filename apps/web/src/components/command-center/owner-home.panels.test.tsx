import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "owner",
  query: { data: undefined as unknown, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
  company: { data: { company: { timezone: "America/Chicago" } }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
  inbox: { data: undefined as unknown, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
  approve: vi.fn(), enabled: [] as boolean[]
}));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/src/stores/auth.store", () => ({ useAuthStore: (select: (s: unknown) => unknown) => select({ user: { role: state.role } }) }));
vi.mock("@/src/hooks/company.hooks", () => ({ useCompany: () => state.company }));
vi.mock("@/src/hooks/command-center.hooks", () => ({ commandCenterKeys: { all: ["command-center"] }, useCommandCenterBrief: (enabled: boolean) => { state.enabled.push(enabled); return state.query; } }));
vi.mock("@/src/hooks/operator-inbox.hooks", () => ({ useOperatorInbox: () => state.inbox, useApproveAgentAction: () => ({ mutateAsync: state.approve, isPending: false }), agentActionErrorMessage: () => "Action failed" }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }) }));
vi.mock("@/src/components/revenue-agent/AgentProposalCard", () => ({ AgentProposalCard: () => <div>Proposal details</div> }));
vi.mock("@/src/components/agent-actions/AgentActionPanel", () => ({ AgentActionPanel: () => <div>Execution controls</div> }));

import { OwnerBusinessRail, OwnerKeyNumbers } from "./OwnerHomePanels";
import { HeaderSummary, NeedsYou } from "./NeedsYou";

const emptyBrief = () => ({
  period: { startDate: "2026-11-01", compareStartDate: "2026-10-01", timeZone: "America/Chicago" },
  kpis: [{ key: "direct_inquiries", label: "Direct inquiries", unit: "count", value: 0, previousValue: 0, numerator: null, denominator: null, definition: "Recorded inquiries", sourceLabel: "Your website", sources: [], sourcesTruncated: false }],
  loop: [{ stage: "discover", label: "Discover · inquiries", count: 0, sources: [], sourcesTruncated: false }],
  crewsToday: [], emptyStates: { hasAnyData: false, missing: ["jobs"] }, limits: { jobsTruncated: false, jobHistoryTruncated: false, actionsTruncated: false }
});

beforeEach(() => {
  state.role = "owner"; state.enabled = [];
  Object.assign(state.query, { data: undefined, isLoading: false, isError: false, isFetching: false });
  Object.assign(state.inbox, { data: undefined, isLoading: false, isError: false, isFetching: false });
  Object.assign(state.company, { isLoading: false, isError: false, isFetching: false });
  state.query.refetch.mockReset(); state.company.refetch.mockReset(); state.inbox.refetch.mockReset();
  state.approve.mockReset().mockResolvedValue({ state: "approved" });
});
afterEach(cleanup);

describe("owner panels distinguish missing data from true empty records", () => {
  it("shows skeletons, never zero metrics, while loading", () => {
    state.query.isLoading = true;
    render(<OwnerKeyNumbers />);
    expect(screen.getAllByTestId("cc-kpi-loading")).toHaveLength(4);
    expect(screen.queryAllByTestId("cc-kpi")).toHaveLength(0);
  });
  it("shows known zero and explains genuinely empty workspace data", () => {
    state.query.data = emptyBrief();
    render(<><OwnerKeyNumbers /><OwnerBusinessRail /></>);
    expect(screen.getAllByTestId("cc-kpi")[0]?.textContent).toContain("0");
    expect(screen.getByText("No crews are set up for today.")).toBeTruthy();
    expect(screen.getByText("No jobs or inquiries have been recorded for this workspace yet.")).toBeTruthy();
  });
  it("does not show stale metrics or crews after a failed refresh", () => {
    state.query.data = { ...emptyBrief(), crewsToday: [{ crewId: "old", name: "Stale crew" }] };
    state.query.isError = true;
    render(<><OwnerKeyNumbers /><OwnerBusinessRail /></>);
    expect(screen.queryByText("Stale crew")).toBeNull();
    expect(screen.queryAllByTestId("cc-kpi")).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]!);
    expect(state.query.refetch).toHaveBeenCalledTimes(1);
  });
  it("keeps failed company context from enabling the brief query", () => {
    state.company.isError = true;
    render(<OwnerKeyNumbers />);
    expect(state.enabled.at(-1)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.company.refetch).toHaveBeenCalledTimes(1);
    expect(state.query.refetch).not.toHaveBeenCalled();
  });
  it("does not request owner metrics for technicians", () => {
    state.role = "technician";
    const result = render(<><OwnerKeyNumbers /><OwnerBusinessRail /></>);
    expect(result.container.textContent).toBe("");
    expect(state.enabled.every((value) => value === false)).toBe(true);
  });
  it("rejects incomplete response sections instead of claiming an empty workspace", () => {
    state.query.data = {};
    render(<OwnerKeyNumbers />);
    expect(screen.getByTestId("owner-panel-unavailable")).toBeTruthy();
  });
});

describe("owner approval status", () => {
  it("shows unknown counts, not zeros or cached controls, on an inbox error", () => {
    state.inbox.isError = true;
    state.inbox.data = { items: [{ state: "awaiting_approval" }] };
    render(<><HeaderSummary /><NeedsYou /></>);
    expect(screen.getByText("Approval status unavailable")).toBeTruthy();
    expect(screen.queryAllByTestId("cc-item")).toHaveLength(0);
    expect(screen.queryByText("Nothing needs you right now.")).toBeNull();
    expect(screen.queryByText("Approvals 0")).toBeNull();
  });
  it("confirms the empty inbox only after a successful empty response", () => {
    state.inbox.data = { items: [] };
    render(<NeedsYou />);
    expect(screen.getByText("Nothing needs you right now.")).toBeTruthy();
  });
  it("does not label a missing items collection as empty", () => {
    state.inbox.data = {};
    render(<NeedsYou />);
    expect(screen.getByTestId("owner-panel-unavailable")).toBeTruthy();
  });
  it("approves the exact action through the existing handler without claiming delivery", async () => {
    state.inbox.data = { items: [{ id: "action-1", version: 7, state: "awaiting_approval", overridePaths: ["approve"], recipient: { displayName: "Test customer" }, provenance: { agentProduct: "revenue_agent", actionType: "revenue.estimate_followup.propose", reason: "Review before approval", sourceEvents: [], policyVersion: "v1" }, executionReceipt: null }] };
    render(<NeedsYou />);
    expect(screen.queryByRole("button", { name: /approve.*send/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Approval recorded. Execution and delivery are tracked separately.")).toBeTruthy();
    expect(state.approve).toHaveBeenCalledTimes(1);
  });
});
