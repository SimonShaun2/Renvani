import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("@/src/lib/api", () => ({ api: { post: m.post, get: m.get } }));

import { recurringSeriesKeys, useApplySeriesChange, usePreviewSeriesChange, useRecurringSeries } from "./recurring-series.hooks";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
const base = "/api/v1/scheduling-agent/recurring-series/s1";

describe("recurring-series hooks", () => {
  it("GETs the series detail, and not when disabled", async () => {
    m.get.mockResolvedValue({ series: {}, occurrences: [], history: [], openExceptions: [] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useRecurringSeries("s1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.get).toHaveBeenCalledWith(base);
    m.get.mockReset();
    renderHook(() => useRecurringSeries("s1", false), { wrapper: setup().wrapper });
    expect(m.get).not.toHaveBeenCalled();
  });

  it("preview POSTs { change } to changes/preview and does not invalidate", async () => {
    m.post.mockReset();
    m.post.mockResolvedValue({ previewHash: "a".repeat(64) });
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => usePreviewSeriesChange("s1"), { wrapper });
    await act(() => result.current.mutateAsync({ action: "pause", reason: "Away for winter" }));
    expect(m.post).toHaveBeenCalledWith(`${base}/changes/preview`, { change: { action: "pause", reason: "Away for winter" } });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("apply POSTs the execute body and invalidates the series", async () => {
    m.post.mockReset();
    m.post.mockResolvedValue({ replayed: false });
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useApplySeriesChange("s1"), { wrapper });
    const body = { expectedVersion: 2, idempotencyKey: "key-12345", previewHash: "b".repeat(64), change: { action: "end" as const, reason: "Sold the house" } };
    await act(() => result.current.mutateAsync(body));
    expect(m.post).toHaveBeenCalledWith(`${base}/changes`, body);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: recurringSeriesKeys.detail("s1") });
  });
});
