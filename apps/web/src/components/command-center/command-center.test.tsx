import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/hooks/company.hooks", () => ({ useCompany: () => ({ data: undefined }) }));
vi.mock("@/src/hooks/operator-inbox.hooks", () => ({
  useOperatorInbox: () => ({ isLoading: true, isError: false, data: undefined }),
  useApproveAgentAction: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

import { CommandCenterView } from "./CommandCenterView";
import { hourIn } from "./LocalClock";
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
    <CommandCenterView firstName="Maya" />
  );
  it("renders header, KPIs with dashes, loop and rail", () => {
    expect(html).toContain("Maya.");
    // Server render is time-neutral: no server-clock greeting or date.
    expect(html).toContain("Hello,");
    expect(html).not.toMatch(/Good (morning|afternoon|evening)/);
    expect(html).toContain("Direct inquiries · —");
    expect(html.match(/data-testid="cc-kpi"/g)).toHaveLength(4);
    expect(html.match(/data-testid="cc-loop"/g)).toHaveLength(4);
    expect(html).toContain(EMPTY);
    expect(html).toContain("Today’s crews");
    expect(html).not.toMatch(/\$1\.99|booking fee/i);
  });
  it("omits name when Clerk user is unavailable", () => {
    const anon = renderToStaticMarkup(<CommandCenterView firstName={null} />);
    expect(anon).not.toContain("Maya");
  });
});

describe("hourIn", () => {
  it("uses the shop time zone when given, else local", () => {
    const d = new Date("2026-10-28T13:00:00.000Z");
    expect(hourIn(d, "America/Chicago")).toBe(8);
    expect(hourIn(d, "Asia/Tokyo")).toBe(22);
    expect(hourIn(d, "Not/AZone")).toBe(d.getHours());
  });
});
