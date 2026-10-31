import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dd = vi.hoisted(() => ({
  role: null as string | null,
  query: { isLoading: false, isError: false, data: undefined as unknown },
  calls: [] as Array<{ range: { startDate: string; endDate: string }; enabled: boolean }>
}));
vi.mock("@/src/stores/auth.store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: dd.role ? { role: dd.role } : null })
}));
vi.mock("@/src/hooks/direct-demand.hooks", () => ({
  useDirectDemandSummary: (range: { startDate: string; endDate: string }, enabled: boolean) => {
    dd.calls.push({ range, enabled });
    return dd.query;
  }
}));

vi.mock("@/src/hooks/company.hooks", () => ({ useCompany: () => ({ data: undefined }) }));
vi.mock("@/src/hooks/operator-inbox.hooks", () => ({
  useOperatorInbox: () => ({ isLoading: true, isError: false, data: undefined }),
  useApproveAgentAction: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

import { CommandCenterView } from "./CommandCenterView";
import { DirectDemandCard } from "./DirectDemandCard";
import { canViewDirectDemand, formatUsdFromDecimal, isoDateIn, jobsLabel, monthToDateRange } from "./direct-demand.utils";
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

describe("DirectDemandCard", () => {
  const now = new Date("2026-10-31T21:00:00.000Z");
  const render = () => renderToStaticMarkup(<DirectDemandCard now={now} />);
  beforeEach(() => {
    dd.role = "owner";
    dd.query = { isLoading: false, isError: false, data: undefined };
    dd.calls = [];
  });
  const summary = (jobCount: number, paidRevenue: string) => ({
    period: { startDate: "2026-10-02", endDate: "2026-10-31", timeZone: "America/Chicago" },
    totals: { jobCount, paidRevenue },
    sources: []
  });

  it("shows a skeleton while loading", () => {
    dd.query = { isLoading: true, isError: false, data: undefined };
    const html = render();
    expect(html).toContain("cc-direct-demand-loading");
    expect(html).toContain("Direct demand");
  });
  it("shows jobs and USD revenue with the caption", () => {
    dd.query = { isLoading: false, isError: false, data: summary(12, "4830.5") };
    const html = render();
    expect(html).toContain("12 jobs, $4,830.50");
    expect(html).toContain("This month, from online booking and lead sources");
    expect(html).not.toContain("Last 30 days");
    expect(html).not.toMatch(/\$1\.99|booking fee|service fee/i);
  });
  it("shows the zero state", () => {
    dd.query = { isLoading: false, isError: false, data: summary(0, "0") };
    const html = render();
    expect(html).toContain("0 jobs, $0.00");
    expect(html).toContain("No direct-demand jobs yet");
  });
  it("shows neutral text on error, never the raw error", () => {
    dd.query = { isLoading: false, isError: true, data: undefined, error: new Error("500 boom") } as never;
    const html = render();
    expect(html).toContain("Direct demand isn’t available right now.");
    expect(html).not.toContain("boom");
  });
  it("is hidden for technicians and does not enable the query", () => {
    dd.role = "technician";
    expect(render()).toBe("");
    expect(dd.calls.every((c) => c.enabled === false)).toBe(true);
  });
  it("dispatcher sees it and queries the same calendar month as the Key numbers tiles", () => {
    dd.query = { isLoading: false, isError: false, data: summary(1, "99.999") };
    const html = render();
    expect(html).toContain("1 job, $100.00");
    expect(dd.calls.at(-1)).toEqual({ range: { startDate: "2026-10-01", endDate: "2026-10-31" }, enabled: true });
  });
});

describe("direct-demand utils", () => {
  it("formats decimal strings without float drift", () => {
    expect(formatUsdFromDecimal("0.1")).toBe("$0.10");
    expect(formatUsdFromDecimal("1234567.005")).toBe("$1,234,567.01");
    expect(formatUsdFromDecimal("999.995")).toBe("$1,000.00");
    expect(formatUsdFromDecimal("9007199254740993.10")).toBe("$9,007,199,254,740,993.10");
    expect(formatUsdFromDecimal("")).toBe("$0.00");
    expect(formatUsdFromDecimal("abc")).toBe("$0.00");
  });
  it("computes the range in the shop time zone", () => {
    const late = new Date("2026-11-01T03:30:00.000Z"); // Oct 31, 10:30 PM in Chicago
    expect(monthToDateRange(late, "America/Chicago")).toEqual({ startDate: "2026-10-01", endDate: "2026-10-31" });
    expect(monthToDateRange(late, "Asia/Tokyo")).toEqual({ startDate: "2026-11-01", endDate: "2026-11-01" });
    expect(monthToDateRange(late, "Bad/Zone").startDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(isoDateIn(late, "Bad/Zone")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("gates roles like the API and pluralizes jobs", () => {
    expect(["owner", "admin", "dispatcher"].every(canViewDirectDemand)).toBe(true);
    expect(["technician", "office", null].some(canViewDirectDemand)).toBe(false);
    expect(jobsLabel(1)).toBe("1 job");
  });
});
