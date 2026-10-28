import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/hooks/operator-inbox.hooks", () => ({
  useOperatorInbox: () => ({ isLoading: true, isError: false, data: undefined }),
  useApproveAgentAction: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

import { CommandCenterView } from "./CommandCenterView";
import { CC_REGIONS, EMPTY, KPIS, agentLabel, greetingFor, itemStatus, needsYouCounts } from "./command-center.config";

describe("command center config", () => {
  it("registers the Figma 10:2 regions", () => {
    expect(CC_REGIONS.map((r) => r.figma)).toEqual(["10:64", "10:74", "10:96", "10:168"]);
  });
  it("counts approvals and exceptions", () => {
    const items = ["awaiting_approval", "awaiting_approval", "escalated", "failed", "approved"].map((state) => ({ state }));
    expect(needsYouCounts(items)).toEqual({ approvals: 2, exceptions: 2 });
  });
  it("labels states and agents", () => {
    expect(itemStatus("escalated").label).toBe("Escalated");
    expect(itemStatus("awaiting_approval").label).toBe("Needs approval");
    expect(agentLabel("revenue_agent")).toBe("Revenue Agent");
    expect(agentLabel("scheduling")).toBe("Scheduling Agent");
    expect(greetingFor(8)).toBe("Good morning,");
    expect(greetingFor(19)).toBe("Good evening,");
  });
  it("KPIs have no invented numbers yet", () => {
    expect(KPIS.every((k) => k.value() === null)).toBe(true);
  });
});

describe("CommandCenterView", () => {
  const html = renderToStaticMarkup(
    <CommandCenterView greeting="Good morning," firstName="Maya" dateLabel="Wednesday, Oct 28" monthLabel="Oct" />
  );
  it("renders header, KPIs with dashes, loop and rail", () => {
    expect(html).toContain("Maya.");
    expect(html).toContain("Direct inquiries · Oct");
    expect(html.match(/data-testid="cc-kpi"/g)).toHaveLength(4);
    expect(html.match(/data-testid="cc-loop"/g)).toHaveLength(4);
    expect(html).toContain(EMPTY);
    expect(html).toContain("Today’s crews");
    expect(html).not.toMatch(/\$1\.99|booking fee/i);
  });
  it("omits name when Clerk user is unavailable", () => {
    const anon = renderToStaticMarkup(<CommandCenterView greeting="Good morning," firstName={null} dateLabel="x" monthLabel="Oct" />);
    expect(anon).not.toContain("Maya");
  });
});
