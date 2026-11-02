// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@fsm/types";
import { ApiError } from "@/src/lib/api";

const mocks = vi.hoisted(() => ({
  today: vi.fn(),
  details: vi.fn(),
  breakpoint: vi.fn(),
  retry: vi.fn()
}));

vi.mock("@/src/hooks/jobs.hooks", () => ({
  useMobileToday: mocks.today,
  useTodayJobDetails: mocks.details
}));
vi.mock("@/src/hooks/useBreakpoint", () => ({ useBreakpoint: mocks.breakpoint }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  )
}));

import { TodayJobsList } from "./TodayJobsList";

const scheduledStart = new Date().toISOString();
function mobileJob(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `job-${index}`,
    jobNumber: `J-${index}`,
    title: `Job ${index}`,
    status: "scheduled",
    priority: "normal",
    customerId: `customer-${index}`,
    propertyId: `property-${index}`,
    technicianId: "tech-1",
    scheduledStart,
    scheduledEnd: null,
    actualStart: null,
    onTheWayAt: null,
    updatedAt: scheduledStart,
    recordVersion: `version-${index}`,
    checklist: [],
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.breakpoint.mockReturnValue({ isTablet: false });
  mocks.today.mockReturnValue({
    data: { date: scheduledStart.slice(0, 10), technicianId: "tech-1", jobs: [mobileJob(1)] },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: mocks.retry
  });
  mocks.details.mockImplementation((ids: string[]) => ids.map(() => ({
    data: { job: {
      customer: { firstName: "Dana", lastName: "Hill", phone: "555-0101" },
      property: { addressLine1: "1 Main St", city: "Austin", state: "TX" }
    } },
    isError: false
  })));
});
afterEach(cleanup);

describe("Technician Today", () => {
  it("shows the server-assigned day without a generic 50-job page limit", () => {
    const jobs = Array.from({ length: 51 }, (_, index) => mobileJob(index + 1));
    mocks.today.mockReturnValue({ data: { date: scheduledStart.slice(0, 10), technicianId: "tech-1", jobs }, isLoading: false, isError: false });
    render(<TodayJobsList />);

    expect(screen.getAllByText("51 jobs today").length).toBeGreaterThan(0);
    expect(screen.getByText("J-51")).toBeTruthy();
    expect(mocks.details).toHaveBeenCalledWith(jobs.map((job) => job.id));
    expect(document.body.textContent).not.toMatch(/\$|potential|Carrier HVAC Unit/i);
  });

  it("preserves the server's route order and does not add an unscheduled generic-list job", () => {
    mocks.today.mockReturnValue({
      data: { date: scheduledStart.slice(0, 10), technicianId: "tech-1", jobs: [mobileJob(2), mobileJob(1)] },
      isLoading: false,
      isError: false
    });
    render(<TodayJobsList />);

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain("J-2");
    expect(cards[1]?.textContent).toContain("J-1");
    expect(screen.queryByText("Unscheduled")).toBeNull();
  });

  it("keeps the assigned card and details link when optional enrichment fails", () => {
    mocks.details.mockReturnValue([{ data: undefined, isError: true }]);
    render(<TodayJobsList />);

    expect(screen.getByText("J-1")).toBeTruthy();
    expect(screen.getByText("Customer details unavailable")).toBeTruthy();
    expect(screen.getByText("Address unavailable")).toBeTruthy();
    expect(screen.getByText("Nav unavailable")).toBeTruthy();
    expect(screen.getByText("Call unavailable")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View Details" }).getAttribute("href")).toBe("/mobile/jobs/job-1");
  });

  it("keeps tablet cards when enrichment fails without invented values", () => {
    mocks.breakpoint.mockReturnValue({ isTablet: true });
    mocks.details.mockReturnValue([{ data: undefined, isError: true }]);
    render(<TodayJobsList />);

    expect(screen.getByText("J-1")).toBeTruthy();
    expect(screen.getByText("Customer details unavailable")).toBeTruthy();
    expect(screen.getByText("Nav unavailable")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Carrier HVAC Unit|Clock In|potential/i);
  });

  it("retries a failed scoped day instead of claiming no jobs", () => {
    mocks.today.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: mocks.retry });
    render(<TodayJobsList />);

    expect(screen.getByText("Today's jobs are unavailable")).toBeTruthy();
    expect(screen.queryByText("No jobs scheduled today")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry jobs" }));
    expect(mocks.retry).toHaveBeenCalledOnce();
  });

  it("shows an explicit access state for a non-technician session", () => {
    mocks.today.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new ApiError(400, { error: ErrorCode.VALIDATION_ERROR, message: "technicianId required" }), isFetching: false, refetch: mocks.retry });
    render(<TodayJobsList />);

    expect(screen.getByText("Technician schedule unavailable")).toBeTruthy();
    expect(screen.getByText(/This account cannot open a technician schedule/)).toBeTruthy();
    expect(screen.queryByText("No jobs scheduled today")).toBeNull();
  });
});
