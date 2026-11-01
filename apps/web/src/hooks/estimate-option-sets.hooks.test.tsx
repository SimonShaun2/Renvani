import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock("@/src/lib/api", () => ({ api: { get: m.get, post: m.post, patch: m.patch, delete: m.del } }));

import {
  estimateOptionSetKeys,
  useAddEstimateOption,
  useEstimateOptionSet,
  useRemoveEstimateOption,
  useSendOptionSet,
  useUpdateOptionSet
} from "./estimate-option-sets.hooks";

const base = "/api/v1/estimates/option-sets/g1";
const resp = { optionSet: { tierGroupId: "g1", version: 4 }, replayed: false };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
const v = { expectedVersion: 3, idempotencyKey: "key-12345678" };

beforeEach(() => {
  for (const f of Object.values(m)) {
    f.mockReset();
    f.mockResolvedValue(resp);
  }
});

describe("estimate option set hooks", () => {
  it("GETs the set, and not when disabled", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useEstimateOptionSet("g1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.get).toHaveBeenCalledWith(base);
    m.get.mockClear();
    renderHook(() => useEstimateOptionSet("g1", false), { wrapper: setup().wrapper });
    expect(m.get).not.toHaveBeenCalled();
  });

  it("PATCH sends version + key and stores the returned set", async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateOptionSet("g1"), { wrapper });
    await act(() => result.current.mutateAsync({ ...v, recommendedEstimateId: "e2" }));
    expect(m.patch).toHaveBeenCalledWith(base, { ...v, recommendedEstimateId: "e2" });
    expect(client.getQueryData(estimateOptionSetKeys.detail("g1"))).toEqual({ optionSet: resp.optionSet });
  });

  it("add POSTs to /options, send POSTs to /send", async () => {
    const { wrapper } = setup();
    const add = renderHook(() => useAddEstimateOption("g1"), { wrapper });
    const option = { tierLabel: "Best", items: [{ name: "Install", quantity: 1, unitPrice: 100 }] };
    await act(() => add.result.current.mutateAsync({ ...v, option }));
    expect(m.post).toHaveBeenCalledWith(`${base}/options`, { ...v, option });
    const send = renderHook(() => useSendOptionSet("g1"), { wrapper });
    await act(() => send.result.current.mutateAsync(v));
    expect(m.post).toHaveBeenCalledWith(`${base}/send`, v);
  });

  it("DELETE puts expectedVersion + idempotencyKey in the query", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useRemoveEstimateOption("g1"), { wrapper });
    await act(() => result.current.mutateAsync({ ...v, estimateId: "e3" }));
    expect(m.del).toHaveBeenCalledWith(`${base}/options/e3?expectedVersion=3&idempotencyKey=key-12345678`);
  });
});
