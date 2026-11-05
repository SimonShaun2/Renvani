// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EstimateGroupsQuery, EstimateGroupsResponse } from "@fsm/types";
const mocks = vi.hoisted(() => ({ query: vi.fn(), refetch: vi.fn() }));
vi.mock("@/src/hooks/estimate-groups.hooks", () => ({
  useEstimateGroups: mocks.query,
}));
import { EstimateListClient } from "./EstimateListClient";
const row = {
  id: "group:1",
  estimateId: "00000000-0000-4000-8000-000000000001",
  estimateIds: ["00000000-0000-4000-8000-000000000001"],
  estimateNumber: "EST-OLD",
  title: "Older system replacement",
  status: "sent" as const,
  total: "100.10",
  subtotal: "100.10",
  customer: {
    id: "00000000-0000-4000-8000-000000000002",
    firstName: "Dana",
    lastName: "Whitfield",
  },
  sentAt: null,
  expiresAt: null,
  approvedAt: null,
  declinedAt: null,
  createdAt: "2020-01-01T00:00:00.000Z",
  tierCount: 3,
  tierLabel: "Better",
  tierGroupId: "00000000-0000-4000-8000-000000000003",
};
let response: EstimateGroupsResponse;
beforeEach(() => {
  vi.clearAllMocks();
  response = { data: [row], total: 26, page: 1, limit: 25, totalPages: 2 };
  mocks.query.mockImplementation((q: EstimateGroupsQuery) => ({
    data: { ...response, page: q.page },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: mocks.refetch,
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("server-grouped estimate list", () => {
  it("uses the group endpoint contract with a bounded page size", () => {
    render(<EstimateListClient />);
    expect(mocks.query).toHaveBeenLastCalledWith({ page: 1, limit: 25 });
    expect(screen.getByText("EST-OLD")).toBeTruthy();
    expect(screen.getByText("3 tiers")).toBeTruthy();
    expect(screen.getByText(/of 26 quotes/)).toBeTruthy();
  });
  it("requests page two rather than slicing the first batch locally", () => {
    render(<EstimateListClient />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(mocks.query).toHaveBeenLastCalledWith({ page: 2, limit: 25 });
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(mocks.query).toHaveBeenLastCalledWith({ page: 1, limit: 25 });
  });
  it("debounces server-side customer search and resets the page", async () => {
    vi.useFakeTimers();
    render(<EstimateListClient />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Search estimates and customers" }),
      { target: { value: "Dana Whitfield" } },
    );
    await act(async () => {
      vi.advanceTimersByTime(301);
    });
    expect(mocks.query).toHaveBeenLastCalledWith({
      page: 1,
      limit: 25,
      search: "Dana Whitfield",
    });
  });
  it("applies status on the server and returns to page one", () => {
    render(<EstimateListClient />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Approved" }));
    expect(mocks.query).toHaveBeenLastCalledWith({
      page: 1,
      limit: 25,
      status: "approved",
    });
  });
  it("preserves an option set as one server-provided summary and total", () => {
    render(<EstimateListClient />);
    expect(screen.getAllByText("EST-OLD")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "View →" }).getAttribute("href"),
    ).toBe(`/estimates/${row.estimateId}`);
    expect(screen.getByText("$100.10")).toBeTruthy();
  });
  it("keeps search controls present while the results load", () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: mocks.refetch,
    });
    render(<EstimateListClient />);
    expect(
      screen.getByRole("textbox", { name: "Search estimates and customers" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("status", { name: "Loading estimates" }),
    ).toBeTruthy();
    expect(screen.queryByText(/of 0 quotes/)).toBeNull();
  });
  it("hides failed cached rows and counts without claiming a successful empty result", () => {
    mocks.query.mockReturnValue({
      data: response,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    render(<EstimateListClient />);
    expect(screen.queryByText("EST-OLD")).toBeNull();
    expect(screen.queryByText(/of 26 quotes/)).toBeNull();
    expect(screen.getByText("Estimates could not be loaded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
  it("shows accurate true-zero results", () => {
    response = { data: [], total: 0, page: 1, limit: 25, totalPages: 0 };
    render(<EstimateListClient />);
    expect(screen.getByText(/Showing 0–0 of 0 quotes/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("clamps a removed last page only after a successful settled read", async () => {
    const ui = render(<EstimateListClient />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    response = { data: [], total: 1, page: 2, limit: 25, totalPages: 1 };
    ui.rerender(<EstimateListClient />);
    await waitFor(() =>
      expect(mocks.query).toHaveBeenLastCalledWith({ page: 1, limit: 25 }),
    );
  });
  it("does not reset a fast page change after initial mount", async () => {
    vi.useFakeTimers();
    render(<EstimateListClient />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(mocks.query).toHaveBeenLastCalledWith({ page: 2, limit: 25 });
  });
});
