import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("@/src/lib/api", () => ({ api: { post: m.post, get: m.get } }));

import { jobScheduleKeys, useCancelJobVisit, useFlagScheduleException, useJobSchedule, useRescheduleJob } from "./scheduling-changes.hooks";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("scheduling-changes hooks", () => {
  it("GETs the job schedule", async () => {
    m.get.mockResolvedValue({ schedule: { scheduleVersion: 1 }, history: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useJobSchedule("j1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.get).toHaveBeenCalledWith("/api/v1/scheduling-agent/jobs/j1/schedule");
  });

  it("does not fetch when disabled (non-manager roles)", () => {
    m.get.mockReset();
    const { wrapper } = setup();
    renderHook(() => useJobSchedule("j1", false), { wrapper });
    expect(m.get).not.toHaveBeenCalled();
  });

  it.each([
    ["reschedule", useRescheduleJob, { expectedVersion: 1, idempotencyKey: "k-123456", scheduledStart: "a", scheduledEnd: "b", reason: "r" }],
    ["cancel", useCancelJobVisit, { expectedVersion: 1, idempotencyKey: "k-123456", reason: "r" }],
    ["exceptions", useFlagScheduleException, { expectedVersion: 1, idempotencyKey: "k-123456", kind: "weather", note: "n" }]
  ] as const)("POSTs %s and invalidates schedule + jobs", async (path, hook, body) => {
    m.post.mockReset();
    m.post.mockResolvedValue({ replayed: false });
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => (hook as (id: string) => { mutateAsync: (b: unknown) => Promise<unknown> })("j1"), { wrapper });
    await act(() => result.current.mutateAsync(body));
    expect(m.post).toHaveBeenCalledWith(`/api/v1/scheduling-agent/jobs/j1/${path}`, body);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: jobScheduleKeys.detail("j1") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["jobs"] });
  });
});
