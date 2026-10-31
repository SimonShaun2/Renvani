import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandCenterBrief } from "@fsm/types";

const m = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(readonly status: number, payload: { message: string }) {
      super(payload.message);
    }
  }
  return { get: vi.fn(), post: vi.fn(), patch: vi.fn(), ApiError, role: "owner" as string | null };
});
vi.mock("@/src/lib/api", () => ({ api: { get: m.get, post: m.post, patch: m.patch }, ApiError: m.ApiError }));
vi.mock("@/src/stores/auth.store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: m.role ? { role: m.role } : null })
}));
vi.mock("@/src/hooks/company.hooks", () => ({ useCompany: () => ({ data: { company: { timezone: "America/Chicago" } } }) }));

import { BRIEF_PERIOD, briefPath } from "@/src/hooks/command-center.hooks";

import { BriefKpis, BriefRail, DailyBriefCard } from "./DailyBriefCard";
import { canViewBrief, decimalToCents, formatKpiValue, kpiDelta, monthName, ratioLabel, safeRoute } from "./daily-brief.utils";

const src = (kind: string, id: string, label: string, route: string) => ({ kind, id, label, route, occurredAt: null }) as never;

function makeBrief(over: Partial<CommandCenterBrief> = {}): CommandCenterBrief {
  return {
    generatedAt: "2026-10-31T23:00:00.000Z",
    period: { date: "2026-10-31", period: "month", startDate: "2026-10-01", endDate: "2026-10-31", timeZone: "America/Chicago", compareStartDate: "2026-09-01", compareEndDate: "2026-09-30" },
    header: { approvalsWaiting: 1, exceptions: 0 },
    kpis: [
      { key: "direct_inquiries", label: "Direct inquiries", unit: "count", value: 46, numerator: null, denominator: null, previousValue: 41, detail: null, sourceLabel: "Your branded site + app + tracked numbers", definition: "Booking requests…", sources: [src("booking_request", "b1", "INQ-1a2b3c4d", "/booking-requests?id=b1")], sourcesTruncated: false },
      { key: "inquiry_to_booked", label: "Inquiry → booked", unit: "percent", value: 41.3, numerator: 19, denominator: 46, previousValue: 22, detail: null, sourceLabel: "Revenue Agent handoffs", definition: "Booked ÷ requests", sources: [], sourcesTruncated: false },
      { key: "first_to_recurring", label: "First → recurring", unit: "percent", value: null, numerator: 0, denominator: 0, previousValue: null, detail: null, sourceLabel: "Retention offers accepted", definition: "Customers whose first booked job is in the period…", sources: [], sourcesTruncated: false },
      { key: "marketing_revenue", label: "Marketing revenue", unit: "money", value: "9007199254740993.10", numerator: null, denominator: null, previousValue: "0.20", detail: "3 rebookings · 1 campaign", sourceLabel: "Automations + win-back", definition: "Payments…", sources: [src("invoice", "i1", "INV-1001", "/invoices/i1"), src("job", "j1", "J-4519", "/jobs/j1"), src("campaign", "c1", "spring", "https://evil.example"), src("job", "j2", "J-4520", "/jobs/j2")], sourcesTruncated: true }
    ],
    needsYou: {
      counts: { approvals: 1, exceptions: 0 },
      items: [{ kind: "suggestion", state: "awaiting_approval", agentProduct: "revenue_agent", actionId: "act-1", actionType: "send_quote_follow_up", version: 1730000000123, title: "Quote follow-up for J-4519", primaryAction: "approve", occurredAt: "2026-10-31T15:00:00.000Z", sources: [src("agent_action", "act-1", "ACT-act1abcd", "/command-center/approvals?id=act-1")] }],
      truncated: false
    },
    loop: [
      { stage: "discover", label: "Discover · inquiries", count: 46, sources: [], sourcesTruncated: false },
      { stage: "book", label: "Book · confirmed", count: 19, sources: [], sourcesTruncated: false },
      { stage: "complete", label: "Tune-up · completed", count: 12, sources: [], sourcesTruncated: false },
      { stage: "rebook", label: "Rebook · recurring", count: 4, sources: [], sourcesTruncated: false }
    ],
    crewsToday: [{ crewId: "cr1", name: "North crew", jobCount: 3, nextStartAt: "2026-10-31T19:00:00.000Z", status: "on_route", sources: [src("crew", "cr1", "CREW-cr1abcde", "/dispatch?crew=cr1")] }],
    today: { jobsToday: 2, sources: [src("job", "j1", "J-4519", "/jobs/j1")] },
    emptyStates: { hasAnyData: true, missing: [] },
    ...over
  };
}

function mount(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
const all = () => (
  <>
    <DailyBriefCard />
    <BriefKpis />
    <BriefRail />
  </>
);

beforeEach(() => {
  m.get.mockReset();
  m.post.mockReset();
  m.role = "owner";
});
afterEach(cleanup);

describe("daily brief utils", () => {
  it("formats values: count, percent, null percent, money without float drift", () => {
    expect(formatKpiValue({ unit: "count", value: 1046 })).toBe("1,046");
    expect(formatKpiValue({ unit: "percent", value: 41.3 })).toBe("41.3%");
    expect(formatKpiValue({ unit: "percent", value: null })).toBe("—");
    expect(formatKpiValue({ unit: "money", value: "9007199254740993.10" })).toBe("$9,007,199,254,740,993.10");
    expect(decimalToCents("0.1")).toBe(10n);
    expect(decimalToCents("1.005")).toBe(101n);
    expect(decimalToCents("abc")).toBeNull();
  });
  it("computes deltas vs the previous month", () => {
    expect(kpiDelta({ unit: "count", value: 46, previousValue: 41 }, "September")).toBe("+5 vs September");
    expect(kpiDelta({ unit: "percent", value: 41.3, previousValue: 44.8 }, "September")).toBe("−3.5 pts vs September");
    expect(kpiDelta({ unit: "money", value: "0.30", previousValue: "0.10" }, "September")).toBe("+$0.20 vs September");
    expect(kpiDelta({ unit: "money", value: "5", previousValue: "5.00" }, "September")).toBe("±$0.00 vs September");
    expect(kpiDelta({ unit: "percent", value: null, previousValue: 3 }, "September")).toBeNull();
    expect(ratioLabel({ unit: "percent", numerator: 19, denominator: 46 })).toBe("19 of 46");
    expect(monthName("2026-09-01")).toBe("September");
  });
  it("gates roles like the API and links app routes only", () => {
    expect(["owner", "admin"].every(canViewBrief)).toBe(true);
    expect(["dispatcher", "technician", null].some(canViewBrief)).toBe(false);
    expect(safeRoute({ route: "/jobs/j1" })).toBe("/jobs/j1");
    expect(safeRoute({ route: "https://evil.example" })).toBeNull();
    expect(safeRoute({ route: "//evil.example" })).toBeNull();
  });
  it("only ever requests period=month (last_30_days is a 400)", () => {
    expect(BRIEF_PERIOD).toBe("month");
    expect(briefPath("America/Chicago")).toBe("/api/v1/command-center/brief?period=month&timeZone=America%2FChicago");
    expect(briefPath()).not.toMatch(/last_30_days/);
  });
});

describe("DailyBriefCard / BriefKpis / BriefRail", () => {
  it("renders data, null percent with its definition, money, and source links", async () => {
    m.get.mockResolvedValue(makeBrief());
    mount(all());
    expect((await screen.findAllByText("46")).length).toBe(2); // KPI + loop
    expect(m.get).toHaveBeenCalledTimes(1);
    expect(m.get.mock.calls[0]![0]).toBe("/api/v1/command-center/brief?period=month&timeZone=America%2FChicago");
    expect(screen.getByText("+5 vs September")).toBeTruthy();
    expect(screen.getByText("41.3%")).toBeTruthy();
    expect(screen.getByText("19 of 46")).toBeTruthy();
    expect(screen.getByText("Customers whose first booked job is in the period…")).toBeTruthy();
    expect(screen.getByText("$9,007,199,254,740,993.10")).toBeTruthy();
    expect(screen.getByText("3 rebookings · 1 campaign")).toBeTruthy();
    expect(screen.getByRole("link", { name: "INV-1001" }).getAttribute("href")).toBe("/invoices/i1");
    expect(screen.getByRole("link", { name: "INQ-1a2b3c4d" }).getAttribute("href")).toBe("/booking-requests?id=b1");
    expect(screen.getByRole("link", { name: "CREW-cr1abcde" }).getAttribute("href")).toBe("/dispatch?crew=cr1");
    expect(screen.queryByRole("link", { name: "spring" })).toBeNull();
    expect(screen.getByText("+ more")).toBeTruthy();
    expect(screen.getByText("North crew")).toBeTruthy();
    expect(screen.getByText("On route")).toBeTruthy();
    for (const a of screen.getAllByRole("link")) expect(a.className).toMatch(/min-h-11/);
    expect(document.body.textContent).not.toMatch(/confidence|\$1\.99|booking fee|service fee/i);
  });

  it("approve sends expectedVersion: item.version with an Idempotency-Key", async () => {
    m.get.mockResolvedValue(makeBrief());
    m.post.mockResolvedValue({});
    mount(<DailyBriefCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(m.post).toHaveBeenCalledTimes(1));
    const [path, body, opts] = m.post.mock.calls[0]!;
    expect(path).toBe("/api/v1/agent-actions/act-1/approve");
    expect(body).toEqual({ expectedVersion: 1730000000123 });
    expect((opts as { headers: Record<string, string> }).headers["Idempotency-Key"]).toBeTruthy();
    await waitFor(() => expect(m.get).toHaveBeenCalledTimes(2));
  });

  it("hides every section on 403 without showing the raw error", async () => {
    m.get.mockRejectedValue(new m.ApiError(403, { message: "Forbidden role dispatcher" }));
    const { container } = mount(all());
    await waitFor(() => expect(m.get).toHaveBeenCalled());
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });

  it("does not call the API for dispatchers or technicians", () => {
    for (const role of ["dispatcher", "technician"]) {
      m.role = role;
      const { container } = mount(all());
      expect(container.innerHTML).toBe("");
      cleanup();
    }
    expect(m.get).not.toHaveBeenCalled();
  });

  it("shows skeletons while loading", () => {
    m.get.mockReturnValue(new Promise(() => {}));
    mount(all());
    expect(screen.getAllByTestId("cc-kpi-loading")).toHaveLength(4);
    expect(screen.getByTestId("cc-daily-brief-loading")).toBeTruthy();
  });

  it("shows a neutral error state (after the 5xx retries)", { timeout: 10000 }, async () => {
    m.get.mockRejectedValue(new m.ApiError(500, { message: "db exploded" }));
    mount(all());
    expect(await screen.findByText("Key numbers aren’t available right now.", {}, { timeout: 6000 })).toBeTruthy();
    expect(screen.getByText("Today’s brief isn’t available right now.")).toBeTruthy();
    expect(document.body.textContent).not.toContain("exploded");
  });

  it("shows the empty state", async () => {
    const empty = makeBrief({
      kpis: makeBrief().kpis.map((k) => ({ ...k, value: k.unit === "count" ? 0 : k.unit === "money" ? "0.00" : null, previousValue: null, sources: [], sourcesTruncated: false })),
      needsYou: { counts: { approvals: 0, exceptions: 0 }, items: [], truncated: false },
      crewsToday: [],
      today: { jobsToday: 0, sources: [] },
      emptyStates: { hasAnyData: false, missing: ["inquiries", "jobs", "agent_actions", "crews"] }
    });
    m.get.mockResolvedValue(empty);
    mount(all());
    expect(await screen.findByTestId("cc-daily-brief-empty")).toBeTruthy();
    expect(screen.getByText(/No jobs or inquiries yet/)).toBeTruthy();
    expect(screen.getByText("No crews are set up for today.")).toBeTruthy();
    expect(screen.getAllByText("No September data").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("cc-kpi-definition")).toHaveLength(2);
  });
});
