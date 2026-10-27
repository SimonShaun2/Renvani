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

  it("renders rows linking to job detail", () => {
    useJobsList.mockReturnValue({ data: { data: [job], total: 1, page: 1, limit: 25, totalPages: 1 }, isLoading: false, isError: false });
    render(<JobsListClient />);
    expect(screen.getByRole("link", { name: "Water heater replacement" }).getAttribute("href")).toBe("/jobs/j1");
    expect(screen.getByRole("table").textContent).toContain("In Progress");
    expect(screen.getByText("Unassigned")).toBeTruthy();
  });

  it("passes status filter to the query", () => {
    useJobsList.mockReturnValue({ data: { data: [], total: 0, page: 1, limit: 25, totalPages: 1 }, isLoading: false, isError: false });
    render(<JobsListClient />);
    expect(screen.getByText("No jobs yet")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "completed" } });
    expect(useJobsList).toHaveBeenLastCalledWith(expect.objectContaining({ status: "completed", page: 1 }));
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
