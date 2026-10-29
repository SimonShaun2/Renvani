import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useJobsList = vi.fn();
const useBreakpoint = vi.fn();

vi.mock("@/src/hooks/jobs.hooks", () => ({ useJobsList: (query: unknown) => useJobsList(query) }));
vi.mock("@/src/hooks/technicians.hooks", () => ({
  useCurrentTechnician: () => ({ technician: { id: "tech-1", firstName: "Alex", lastName: "Lee" }, isLoading: false, isError: false })
}));
vi.mock("@/src/hooks/useBreakpoint", () => ({ useBreakpoint: () => useBreakpoint() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}));

import { TodayJobsList } from "./TodayJobsList";

const job = {
  id: "job-1",
  jobNumber: "J-1",
  title: "Water heater repair",
  type: "service_call",
  priority: "normal",
  status: "scheduled",
  scheduledStart: new Date().toISOString(),
  scheduledEnd: null,
  customer: { id: "customer-1", firstName: "Dana", lastName: "Hill", phone: null },
  property: { id: "property-1", addressLine1: "1 Main St", city: "Austin", state: "TX" },
  technician: null,
  createdAt: new Date().toISOString()
};

beforeEach(() => {
  useJobsList.mockReset();
  useBreakpoint.mockReset();
  useJobsList.mockReturnValue({
    data: { data: [job], total: 57, page: 1, limit: 50, totalPages: 2 },
    isLoading: false,
    isError: false
  });
});
afterEach(cleanup);

describe("Today jobs summary", () => {
  it("shows a source-backed visible count on mobile without invented revenue", () => {
    useBreakpoint.mockReturnValue({ isTablet: false });
    render(<TodayJobsList />);

    expect(screen.getAllByText("1 job shown").length).toBeGreaterThan(0);
    expect(screen.getByText("Water heater repair")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\$|potential|technician app live/i);
  });

  it("shows the visible count on tablet without claiming the page is the full day", () => {
    useBreakpoint.mockReturnValue({ isTablet: true });
    render(<TodayJobsList />);

    expect(screen.getAllByText("1 job shown").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\$|potential|scheduled stops/i);
  });
});
