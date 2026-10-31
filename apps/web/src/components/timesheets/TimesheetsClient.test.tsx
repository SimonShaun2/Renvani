import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  routes: {} as Record<string, () => Promise<unknown>>,
  post: vi.fn(),
  patch: vi.fn(),
  fetch: vi.fn()
}));

vi.mock("@/src/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/src/lib/api")>();
  const get = (path: string) => {
    const key = Object.keys(m.routes).find((prefix) => path.startsWith(prefix));
    const fn = key ? m.routes[key] : undefined;
    return fn ? fn() : Promise.reject(new Error(`unmocked ${path}`));
  };
  return { ...actual, api: { get, post: m.post, patch: m.patch, put: m.post, delete: m.post }, authorizedFetch: m.fetch };
});

import { ApiError } from "@/src/lib/api";
import { useAuthStore } from "@/src/stores/auth.store";
import { TimesheetsClient, currentWeekPeriod, formatMinutes } from "./TimesheetsClient";
import { isConflict, payrollCsvFileName } from "@/src/hooks/timesheets.hooks";

const TECH = { id: "11111111-1111-4111-8111-111111111111", firstName: "Ava", lastName: "Reyes" };
const entry = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  technicianId: TECH.id,
  jobId: "j1",
  startedAt: "2026-10-26T14:00:00.000Z",
  endedAt: "2026-10-26T16:30:00.000Z",
  durationMinutes: 150,
  entryType: "on_site",
  notes: null,
  workDate: "2026-10-26",
  timesheetStatus: null,
  locked: false,
  createdAt: "",
  updatedAt: "",
  recordVersion: "v1",
  ...over
});
const sheet = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  technicianId: TECH.id,
  periodStart: "2026-10-26",
  periodEnd: "2026-11-01",
  status: "submitted",
  rejectionReason: null,
  recordVersion: "sv1",
  ...over
});
const page = <T,>(key: string, rows: T[]) => () => Promise.resolve({ [key]: rows, limit: 50, offset: 0, hasMore: false });
const summary = (lines: unknown[]) => () =>
  Promise.resolve({ summary: { lines, totals: { regularMinutes: 2400, overtimeMinutes: 60, totalMinutes: 2460, grossPayCents: 123450 } } });

function setRole(role: string) {
  useAuthStore.setState({ user: { id: "u1", role } as never });
}

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <TimesheetsClient />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  setRole("owner");
  m.routes = {
    "/api/v1/technicians": () => Promise.resolve({ data: [TECH], total: 1, page: 1, limit: 100, totalPages: 1 }),
    "/api/v1/time/entries": page("entries", [entry()]),
    "/api/v1/timesheets": page("timesheets", [sheet()]),
    "/api/v1/payroll/summary": summary([])
  };
  m.post.mockReset().mockResolvedValue({ timesheet: sheet({ status: "approved" }) });
  m.patch.mockReset().mockResolvedValue({ entry: entry() });
  m.fetch.mockReset();
});

afterEach(() => cleanup());

describe("TimesheetsClient", () => {
  it("shows loading skeletons, not empty states, while technicians load", () => {
    m.routes["/api/v1/technicians"] = () => new Promise(() => {});
    const { container } = renderClient();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByText("No time entries")).toBeNull();
    expect(screen.queryByText("No active technicians")).toBeNull();
  });

  it("shows empty states for no entries and no timesheets", async () => {
    m.routes["/api/v1/time/entries"] = page("entries", []);
    m.routes["/api/v1/timesheets"] = page("timesheets", []);
    renderClient();
    expect(await screen.findByText("No time entries")).toBeTruthy();
    expect(await screen.findByText("No timesheets")).toBeTruthy();
    expect(await screen.findByText("No approved hours")).toBeTruthy();
  });

  it("shows a retryable error state, distinct from empty, when time entries fail", async () => {
    let calls = 0;
    m.routes["/api/v1/time/entries"] = () => {
      calls += 1;
      return Promise.reject(new Error("boom"));
    };
    renderClient();
    expect(await screen.findByText("Couldn't load time entries")).toBeTruthy();
    expect(screen.queryByText("No time entries")).toBeNull();
    const before = calls;
    fireEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]!);
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });

  it("lists entries, edits an unlocked entry with its recordVersion, and keeps locked entries read-only", async () => {
    m.routes["/api/v1/time/entries"] = page("entries", [entry(), entry({ id: "e2", locked: true, timesheetStatus: "approved" })]);
    renderClient();
    const locked = await screen.findByTestId("time-entry-e2");
    expect(locked.textContent).toContain("Locked");
    expect(locked.querySelector("button")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.patch).toHaveBeenCalled());
    const [path, body] = m.patch.mock.calls[0]!;
    expect(path).toBe("/api/v1/time/entries/e1");
    expect(body).toMatchObject({ recordVersion: "v1", notes: null });
  });

  it("approves a submitted timesheet and shows approved periods as read-only", async () => {
    m.routes["/api/v1/timesheets"] = page("timesheets", [sheet(), sheet({ id: "s2", status: "approved", periodStart: "2026-10-19", periodEnd: "2026-10-25" })]);
    renderClient();
    const approved = await screen.findByTestId("timesheet-s2");
    expect(approved.textContent).toContain("Read-only");
    expect(approved.textContent).not.toContain("Submit");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(m.post).toHaveBeenCalledWith("/api/v1/timesheets/s1/approve", { recordVersion: "sv1" }));
  });

  it("requires a reason to reject", async () => {
    renderClient();
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(m.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByLabelText("Reason")[0]!, { target: { value: "Missing Tuesday" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(m.post).toHaveBeenCalledWith("/api/v1/timesheets/s1/reject", { reason: "Missing Tuesday", recordVersion: "sv1" }));
  });

  it("shows payroll totals and exports CSV for owners", async () => {
    m.routes["/api/v1/payroll/summary"] = summary([
      { technicianId: TECH.id, technicianName: "Ava Reyes", timesheetIds: ["s2"], regularMinutes: 2400, overtimeMinutes: 60, totalMinutes: 2460, hourlyRateCents: 3000, regularPayCents: 120000, overtimePayCents: 3450, grossPayCents: 123450, missingPayRate: false }
    ]);
    m.fetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(["a,b"])) });
    const createURL = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: createURL, revokeObjectURL: vi.fn() });
    renderClient();
    expect(await screen.findByText("Ava Reyes")).toBeTruthy();
    expect(screen.getAllByText("$1,234.50").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() => expect(m.fetch).toHaveBeenCalled());
    expect(String(m.fetch.mock.calls[0]?.[0])).toMatch(/^\/api\/v1\/payroll\/export\?.*format=csv/);
    await waitFor(() => expect(createURL).toHaveBeenCalled());
  });

  it("hides payroll and approval actions from roles without access", async () => {
    setRole("technician");
    renderClient();
    expect(await screen.findByTestId("timesheet-s1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByLabelText("Payroll")).toBeNull();
  });
});

describe("timesheet helpers", () => {
  it("computes a Monday-Sunday default period", () => {
    expect(currentWeekPeriod(new Date(2026, 9, 31))).toEqual({ periodStart: "2026-10-26", periodEnd: "2026-11-01" });
  });
  it("formats minutes and CSV names, and detects conflicts", () => {
    expect(formatMinutes(150)).toBe("2h 30m");
    expect(formatMinutes(null)).toBe("In progress");
    expect(payrollCsvFileName({ periodStart: "2026-10-26", periodEnd: "2026-11-01" })).toBe("renvani-payroll-2026-10-26-to-2026-11-01.csv");
    expect(isConflict(new ApiError(409, { error: "CONFLICT" as never, message: "stale" }))).toBe(true);
    expect(isConflict(new Error("x"))).toBe(false);
  });
});
