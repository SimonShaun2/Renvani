// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  role: "dispatcher" as string | null,
  state: {} as Record<string, unknown>,
  calls: [] as Array<{ q: unknown; enabled: boolean }>,
  refetch: vi.fn()
}));

vi.mock("@/src/stores/auth.store", () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: m.role ? { role: m.role } : null }) }));
vi.mock("@/src/hooks/loyalty.hooks", () => ({
  useLoyaltyReminderCandidates: (q: unknown, enabled: boolean) => {
    m.calls.push({ q, enabled });
    return { isLoading: false, isError: false, isFetching: false, data: undefined, refetch: m.refetch, ...(enabled ? m.state : {}) };
  }
}));

import { ReminderCandidatesClient } from "./ReminderCandidatesClient";

const base = {
  customerId: "c1",
  customerName: "Dana Ruiz",
  maintenancePlanId: "p1",
  evidenceJobId: null,
  importSessionId: null,
  planName: "HVAC Comfort Club",
  nextServiceDate: "2026-11-02",
  lastServiceDate: "2026-05-02",
  daysUntilDue: 2,
  daysSinceLastService: null,
  dryRun: true
};

beforeEach(() => {
  m.role = "dispatcher";
  m.state = {};
  m.calls = [];
});
afterEach(cleanup);

describe("ReminderCandidatesClient", () => {
  it("shows no-access and does not fetch for office/technician", () => {
    m.role = "technician";
    render(<ReminderCandidatesClient />);
    expect(screen.getByText(/don't have access/i)).toBeTruthy();
    expect(m.calls.every((c) => !c.enabled)).toBe(true);
  });

  it("renders grouped rows, links customers, local dates, and preview banner", () => {
    m.state = {
      data: {
        dryRun: true,
        candidates: [
          { ...base, ruleFamily: "plan_cadence" },
          { ...base, ruleFamily: "lapsed_reactivation", customerId: "c2", customerName: "Lee Park", planName: null, maintenancePlanId: null, lastServiceDate: "2025-10-01", daysUntilDue: null, daysSinceLastService: 395 }
        ]
      }
    };
    render(<ReminderCandidatesClient />);
    expect(screen.getByTestId("preview-banner").textContent).toMatch(/Preview only: no messages are sent/);
    expect(screen.getByText("Dana Ruiz").closest("a")?.getAttribute("href")).toBe("/customers/c1");
    expect(screen.getByText("Nov 2, 2026")).toBeTruthy();
    expect(screen.getByText("In 2 days")).toBeTruthy();
    expect(screen.getByTestId("group-lapsed_reactivation").textContent).toMatch(/395 days ago/);
    expect(screen.getByText("No plan")).toBeTruthy();
    expect(screen.queryByText(/send/i)).toBeNull();
  });

  it("validates filters and applies them", () => {
    render(<ReminderCandidatesClient />);
    const [h, l] = screen.getAllByRole("textbox");
    fireEvent.change(h!, { target: { value: "91" } });
    fireEvent.click(screen.getByRole("button", { name: "Update preview" }));
    expect(screen.getByTestId("filter-error").textContent).toMatch(/between 1 and 90/);
    fireEvent.change(h!, { target: { value: "30" } });
    fireEvent.change(l!, { target: { value: "800" } });
    fireEvent.click(screen.getByRole("button", { name: "Update preview" }));
    expect(screen.getByTestId("filter-error").textContent).toMatch(/between 1 and 730/);
    fireEvent.change(l!, { target: { value: "365" } });
    fireEvent.click(screen.getByRole("button", { name: "Update preview" }));
    expect(screen.queryByTestId("filter-error")).toBeNull();
    expect(m.calls.at(-1)?.q).toEqual({ horizonDays: 30, lapsedDays: 365 });
  });

  it("shows empty and error states", () => {
    m.state = { data: { candidates: [], dryRun: true } };
    render(<ReminderCandidatesClient />);
    expect(screen.getByTestId("empty-state")).toBeTruthy();
    cleanup();
    m.state = { isError: true };
    render(<ReminderCandidatesClient />);
    expect(screen.getByText("Couldn't load service reminders")).toBeTruthy();
  });
});
