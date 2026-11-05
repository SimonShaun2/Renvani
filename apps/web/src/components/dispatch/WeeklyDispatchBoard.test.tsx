// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DispatchWeekResponse, DispatchWeekJob } from "@fsm/types";

const mocks = vi.hoisted(() => ({ query: vi.fn(), refetch: vi.fn() }));
vi.mock("@/src/hooks/dispatch-week.hooks", () => ({
  useDispatchWeek: mocks.query,
}));
import { WeeklyDispatchBoard } from "./WeeklyDispatchBoard";
import {
  formatWeekDate,
  formatWeeklyJobTime,
  weeklyJobContinuation,
} from "./weekly-dispatch.utils";

const jobId = "00000000-0000-4000-8000-000000000001",
  techId = "00000000-0000-4000-8000-000000000002";
const baseJob: DispatchWeekJob = {
  id: jobId,
  jobNumber: "J-1",
  title: "System check",
  status: "scheduled",
  scheduledStart: "2026-11-03T05:00:00.000Z",
  scheduledEnd: "2026-11-03T07:00:00.000Z",
  timingWarning: null,
  technicianId: techId,
  technicianName: "Marco",
  assignmentState: "assigned",
  customerName: "Example customer",
  address: null,
};
function fixture(): DispatchWeekResponse {
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-11-${String(i + 2).padStart(2, "0")}`,
    start: `2026-11-${String(i + 2).padStart(2, "0")}T06:00:00.000Z`,
    endExclusive: `2026-11-${String(i + 3).padStart(2, "0")}T06:00:00.000Z`,
    jobIds: i < 2 ? [jobId] : [],
  }));
  return {
    timezone: "America/Chicago",
    today: "2026-11-05",
    weekStart: "2026-11-02",
    weekEnd: "2026-11-08",
    previousWeek: "2026-10-26",
    nextWeek: "2026-11-09",
    rangeStart: days[0]!.start,
    rangeEndExclusive: days[6]!.endExclusive,
    generatedAt: "2026-11-05T14:00:00.000Z",
    uniqueJobCount: 1,
    technicians: [{ id: techId, name: "Marco", status: "active" }],
    days,
    jobs: [baseJob],
  };
}
let data: DispatchWeekResponse;
beforeEach(() => {
  vi.clearAllMocks();
  data = fixture();
  mocks.query.mockImplementation(() => ({
    data,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: mocks.refetch,
  }));
  mocks.refetch.mockResolvedValue({ data });
});
afterEach(cleanup);
describe("weekly dispatch view", () => {
  it("renders all seven local days, one unique count and both overnight appearances", () => {
    render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    expect(screen.getAllByRole("link", { name: /View J-1/ })).toHaveLength(2);
    expect(
      screen.getByText("1 job this week · 1 spans multiple days"),
    ).toBeTruthy();
    expect(screen.getByText("Continues into the next day.")).toBeTruthy();
    expect(screen.getByText("Continued from an earlier day.")).toBeTruthy();
    expect(screen.getAllByText("No scheduled jobs")).toHaveLength(5);
    expect(
      screen.getByRole("region", { name: "Sunday, November 8" }),
    ).toBeTruthy();
  });
  it("uses backend previous/next anchors and omits a browser-derived date for Today", async () => {
    render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    expect(mocks.query).toHaveBeenLastCalledWith({ technician: "all" });
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(mocks.query).toHaveBeenLastCalledWith({
      date: "2026-10-26",
      technician: "all",
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(mocks.query).toHaveBeenLastCalledWith({
      date: "2026-11-09",
      technician: "all",
    });
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(mocks.query).toHaveBeenLastCalledWith({ technician: "all" });
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it("filters using technician identity, including unassigned work", () => {
    render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Technician" }), {
      target: { value: techId },
    });
    expect(mocks.query).toHaveBeenLastCalledWith({ technician: techId });
    fireEvent.change(screen.getByRole("combobox", { name: "Technician" }), {
      target: { value: "unassigned" },
    });
    expect(mocks.query).toHaveBeenLastCalledWith({ technician: "unassigned" });
  });
  it("shows true emptiness rather than an unavailable schedule", () => {
    data.jobs = [];
    data.uniqueJobCount = 0;
    for (const d of data.days) d.jobIds = [];
    render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    expect(screen.getByText("0 jobs this week")).toBeTruthy();
    expect(screen.getAllByText("No scheduled jobs")).toHaveLength(7);
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("shows loading without a zero count or stale job links", () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: mocks.refetch,
    });
    render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    expect(
      screen.getByRole("status", { name: "Loading weekly schedule" }),
    ).toBeTruthy();
    expect(screen.queryByText(/0 jobs/)).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
  it("hides cached jobs after a refresh fails and supports retry", () => {
    mocks.query.mockReturnValue({
      data,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText(/job this week/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it("treats a missing successful response as unavailable", () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });
    render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });
  it("exposes job-detail links without schedule mutation controls", () => {
    const onDay = vi.fn();
    render(<WeeklyDispatchBoard onDayView={onDay} />);
    expect(screen.getAllByRole("link")[0]?.getAttribute("href")).toBe(
      `/jobs/${jobId}`,
    );
    expect(
      screen.queryByRole("button", {
        name: /assign|reschedule|complete|charge/i,
      }),
    ).toBeNull();
    for (const button of screen.getAllByRole("button", { name: "Day view" }))
      fireEvent.click(button);
    expect(onDay).toHaveBeenCalledTimes(2);
  });
  it("keeps missing timing and assignment explicit", () => {
    data.jobs = [
      {
        ...baseJob,
        scheduledEnd: null,
        timingWarning: "missing_end",
        assignmentState: "unavailable",
        technicianName: null,
        customerName: null,
      },
    ];
    render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    expect(screen.getAllByText(/end time unavailable/)).toHaveLength(2);
    expect(screen.getAllByText("Customer unavailable")).toHaveLength(2);
    expect(screen.getAllByText(/Assignment unavailable/)).toHaveLength(2);
  });
  it("disables rapid date-navigation while a request is in flight", () => {
    mocks.query.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      isFetching: true,
      refetch: mocks.refetch,
    });
    render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("recovers with real data after a retry", async () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    const ui = render(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    mocks.query.mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });
    ui.rerender(<WeeklyDispatchBoard onDayView={vi.fn()} />);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
describe("weekly date presentation", () => {
  it("does not shift date-only headings with the machine timezone", () =>
    expect(formatWeekDate("2026-11-02")).toBe("Mon 2"));
  it("formats times in the company timezone", () =>
    expect(formatWeeklyJobTime(baseJob, "America/Chicago")).toContain(
      "11:00 PM CST",
    ));
  it("does not claim continuation at an exact day-end boundary", () => {
    expect(
      weeklyJobContinuation(
        { ...baseJob, scheduledEnd: "2026-11-03T06:00:00.000Z" },
        {
          start: "2026-11-02T06:00:00.000Z",
          endExclusive: "2026-11-03T06:00:00.000Z",
        },
      ),
    ).toBe("View job");
  });
});
