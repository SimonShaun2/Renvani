// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EstimateGroupsQuery } from "@fsm/types";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/src/lib/api", () => ({ api: { get: mocks.get } }));
import { useEstimateGroups } from "./estimate-groups.hooks";
import { useDispatchWeek } from "./dispatch-week.hooks";
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
});
afterEach(() => {
  cleanup();
  client.clear();
});
describe("workflow read hooks", () => {
  it("sends group search, status and paging to the additive endpoint", async () => {
    mocks.get.mockResolvedValue({ data: [], total: 0, totalPages: 0 });
    const h = renderHook(
      () =>
        useEstimateGroups({
          page: 2,
          limit: 25,
          status: "sent",
          search: "Dana & Sons",
        }),
      { wrapper },
    );
    await waitFor(() => expect(h.result.current.isSuccess).toBe(true));
    const url = new URL(mocks.get.mock.calls[0]![0], "https://test.invalid");
    expect(url.pathname).toBe("/api/v1/estimates/groups");
    expect(url.searchParams.get("search")).toBe("Dana & Sons");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("status")).toBe("sent");
  });
  it("does not replace a new search with an older delayed response", async () => {
    let finishOld: ((value: unknown) => void) | undefined;
    mocks.get.mockImplementation((url: string) =>
      url.includes("search=old")
        ? new Promise((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve({ data: [], total: 2, totalPages: 1 }),
    );
    const h = renderHook(
      (query: EstimateGroupsQuery) => useEstimateGroups(query),
      { wrapper, initialProps: { page: 1, limit: 25, search: "old" } },
    );
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    h.rerender({ page: 1, limit: 25, search: "new" });
    await waitFor(() => expect(h.result.current.data?.total).toBe(2));
    await act(async () => {
      finishOld?.({ data: [], total: 99, totalPages: 4 });
    });
    expect(h.result.current.data?.total).toBe(2);
  });
  it("uses one weekly request and lets the server choose today's local date", async () => {
    mocks.get.mockResolvedValue({ uniqueJobCount: 0 });
    const h = renderHook(() => useDispatchWeek({ technician: "all" }), {
      wrapper,
    });
    await waitFor(() => expect(h.result.current.isSuccess).toBe(true));
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(
      "/api/v1/dispatch/week?technician=all",
    );
    expect(
      client.getQueryCache().findAll({ queryKey: ["dispatch", "week"] }),
    ).toHaveLength(1);
  });
  it("refreshes weekly data through the existing dispatch invalidation prefix", async () => {
    mocks.get.mockResolvedValue({ uniqueJobCount: 0 });
    const h = renderHook(
      () => useDispatchWeek({ technician: "unassigned", date: "2026-11-02" }),
      { wrapper },
    );
    await waitFor(() => expect(h.result.current.isSuccess).toBe(true));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["dispatch"] });
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenLastCalledWith(
      "/api/v1/dispatch/week?technician=unassigned&date=2026-11-02",
    );
  });
  it("propagates read failures instead of manufacturing empty data", async () => {
    mocks.get.mockRejectedValue(new Error("unavailable"));
    const h = renderHook(() => useDispatchWeek({ technician: "all" }), {
      wrapper,
    });
    await waitFor(() => expect(h.result.current.isError).toBe(true));
    expect(h.result.current.data).toBeUndefined();
  });
  it("estimate writes can invalidate grouped pages using the existing prefix", async () => {
    mocks.get.mockResolvedValue({ data: [], total: 0, totalPages: 0 });
    const h = renderHook(() => useEstimateGroups({ page: 1, limit: 25 }), {
      wrapper,
    });
    await waitFor(() => expect(h.result.current.isSuccess).toBe(true));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["estimates"] });
    });
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });
});
