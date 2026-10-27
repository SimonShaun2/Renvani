import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildJobListQuery, dateInputToIso } from "./jobsList.utils";

const useJobsList = vi.fn();
vi.mock("@/src/hooks/jobs.hooks", () => ({ useJobsList: (q: unknown) => useJobsList(q) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}));

import { JobsListClient } from "./JobsListClient";
import { chipFilters, currentWeek, formatWhen, jobStateChip } from "./jobsList.config";

const job = {
  id: "j1",
  jobNumber: "2041",
  title: "Water heater replacement",
  type: "installation",
  priority: "normal",
  status: "in_progress",
  scheduledStart: "2026-10-26T17:00:00.000Z",
  scheduledEnd: null,
  customer: { id: "c1", firstName: "Dana", lastName: "Whitfield", phone: null },
  property: { id: "p1", addressLine1: "412 Pine St", city: "Austin", state: "TX" },
  technician: null,
  createdAt: "2026-10-01T00:00:00.000Z"
};

describe("buildJobListQuery", () => {
  it("omits empty filters and defaults sorting", () => {
    expect(buildJobListQuery({ status: "all", from: "", to: "", search: " ", page: 0 })).toEqual({
      sortBy: "scheduledStart",
      sortOrder: "asc",
      page: 1,
      limit: 25
    });
  });

  it("maps status and date range to API params", () => {
    const q = buildJobListQuery({ status: "scheduled", from: "2026-10-01", to: "2026-10-31", search: "pine", page: 2 });
    expect(q.status).toBe("scheduled");
    expect(q.search).toBe("pine");
    expect(q.page).toBe(2);
    expect(new Date(q.scheduledAfter!).getDate()).toBe(1);
    expect(new Date(q.scheduledBefore!).getHours()).toBe(23);
  });

  it("rejects malformed dates", () => {
    expect(dateInputToIso("10/01/2026", "start")).toBeUndefined();
  });
});

describe("JobsListClient", () => {
  beforeEach(() => useJobsList.mockReset());
  afterEach(() => cleanup());

  it("renders frame columns with job number, short tech and state chip", () => {
    useJobsList.mockReturnValue({ data: { data: [{ ...job, technician: { id: "t1", firstName: "Marco", lastName: "Ruiz", phone: null, calendarColor: null } }], total: 1, totalPages: 1 }, isLoading: false, isError: false });
    render(<JobsListClient />);
    expect(screen.getByRole("link", { name: "2041" }).getAttribute("href")).toBe("/jobs/j1");
    expect(screen.getByRole("link", { name: "Water heater replacement" }).getAttribute("href")).toBe("/jobs/j1");
    const table = screen.getByRole("table").textContent ?? "";
    expect(table).toContain("Marco R.");
    expect(table).toContain("In progress");
    expect(table).not.toMatch(/Total/i);
    expect(screen.getByRole("button", { name: "All · 1" })).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("unpaid chip filters by invoiced status", () => {
    useJobsList.mockReturnValue({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false, isError: false });
    render(<JobsListClient />);
    expect(screen.getByText("No jobs yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Unpaid/ }));
    expect(useJobsList).toHaveBeenLastCalledWith(expect.objectContaining({ status: "invoiced", limit: 25 }));
    expect(screen.getByText("No jobs match these filters")).toBeTruthy();
  });

  it("shows an error state with retry", () => {
    const refetch = vi.fn();
    useJobsList.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<JobsListClient />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe("jobsList.config", () => {
  const now = new Date(2026, 9, 27, 9, 0);
  it("formats When like the frame", () => {
    expect(formatWhen(new Date(2026, 9, 27, 10, 30).toISOString(), now)).toBe("Today 10:30a");
    expect(formatWhen(new Date(2026, 9, 26, 10, 30).toISOString(), now)).toBe("Yesterday");
    expect(formatWhen(new Date(2026, 9, 20, 10, 30).toISOString(), now)).toBe("Oct 20");
    expect(formatWhen(null, now)).toBe("—");
  });
  it("maps state chips and week range", () => {
    expect(jobStateChip("dispatched")).toEqual({ label: "On the way", tone: "blue" });
    expect(jobStateChip("invoiced").label).toBe("Unpaid");
    expect(currentWeek(now)).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(chipFilters("today", now)).toEqual({ status: "all", from: "2026-10-27", to: "2026-10-27" });
  });
});
