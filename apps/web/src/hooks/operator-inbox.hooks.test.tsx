import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(readonly status: number, payload: { message: string }) {
      super(payload.message);
    }
  }
  return { post: vi.fn(), patch: vi.fn(), get: vi.fn(), ApiError };
});
vi.mock("@/src/lib/api", () => ({ api: { post: m.post, patch: m.patch, get: m.get }, ApiError: m.ApiError }));

import {
  IDEMPOTENCY_CONFLICT_MESSAGE,
  STALE_ITEM_MESSAGE,
  agentActionErrorMessage,
  useApproveAgentAction,
  useEditOperatorInboxItem,
  useExecuteAgentAction,
  useOperatorInboxCounts
} from "./operator-inbox.hooks";

const item = { id: "a1", version: 7 };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

function keyOf(call: unknown[]): string {
  return (call[2] as { headers: Record<string, string> }).headers["Idempotency-Key"]!;
}

beforeEach(() => {
  m.post.mockReset();
  m.patch.mockReset();
});

describe.each([
  ["approve", useApproveAgentAction],
  ["execute", useExecuteAgentAction]
] as const)("%s hook", (op, hook) => {
  it("sends expectedVersion and an Idempotency-Key header", async () => {
    m.post.mockResolvedValue({ id: "a1" });
    const { wrapper } = setup();
    const { result } = renderHook(() => hook(item), { wrapper });
    await act(() => result.current.mutateAsync());
    expect(m.post).toHaveBeenCalledWith(`/api/v1/agent-actions/a1/${op}`, { expectedVersion: 7 }, {
      headers: { "Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/) }
    });
  });

  it("reuses the key when the same action is retried after a network error, new key for a new action", async () => {
    m.post.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue({ id: "a1" });
    const { wrapper } = setup();
    const { result } = renderHook(() => hook(item), { wrapper });
    await act(() => result.current.mutateAsync().catch(() => undefined));
    await act(() => result.current.mutateAsync());
    await act(() => result.current.mutateAsync());
    const keys = m.post.mock.calls.map(keyOf);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("on a stale 409 refetches the inbox, does not retry, and shows the stale message", async () => {
    const err = new m.ApiError(409, { message: "Agent action changed since it was loaded; reload and retry" });
    m.post.mockRejectedValue(err);
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => hook(item), { wrapper });
    await act(() => result.current.mutateAsync().catch(() => undefined));
    expect(m.post).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["operator-inbox"] });
    expect(agentActionErrorMessage(err)).toBe(STALE_ITEM_MESSAGE);
  });
});

describe("409 kinds", () => {
  it("tells an idempotency-key conflict apart from a stale version", () => {
    expect(agentActionErrorMessage(new m.ApiError(409, { message: "Idempotency-Key was already used with a different request" }))).toBe(
      IDEMPOTENCY_CONFLICT_MESSAGE
    );
    expect(agentActionErrorMessage(new m.ApiError(409, { message: "Only awaiting-approval actions can be edited" }))).toBe(STALE_ITEM_MESSAGE);
    expect(agentActionErrorMessage(new m.ApiError(400, { message: "Bad request" }))).toBe("Bad request");
  });
});

describe("edit hook", () => {
  it("PATCHes with expectedVersion and refetches on a stale 409", async () => {
    m.patch.mockResolvedValueOnce({ id: "a1" }).mockRejectedValueOnce(new m.ApiError(409, { message: "Agent action changed" }));
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useEditOperatorInboxItem(item), { wrapper });
    await act(() => result.current.mutateAsync({ body: "hi" }));
    expect(m.patch).toHaveBeenCalledWith("/api/v1/operator/inbox/a1", { body: "hi", expectedVersion: 7 });
    invalidate.mockClear();
    await act(() => result.current.mutateAsync({ body: "x" }).catch(() => undefined));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["operator-inbox"] });
  });
});

describe.each([
  ["approve", useApproveAgentAction],
  ["execute", useExecuteAgentAction]
] as const)("%s result", (_op, hook) => {
  it("refetches the inbox and counts on any error, not only 409", async () => {
    m.post.mockRejectedValue(new m.ApiError(500, { message: "Execution failed" }));
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => hook(item), { wrapper });
    await act(() => result.current.mutateAsync().catch(() => undefined));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["operator-inbox"] });
  });

  it("returns the API's state (no assumed success)", async () => {
    m.post.mockResolvedValue({ id: "a1", state: "executing", executionReceipt: { outcome: "queued", deliveryState: "queued" } });
    const { wrapper } = setup();
    const { result } = renderHook(() => hook(item), { wrapper });
    const out = await act(() => result.current.mutateAsync());
    expect(out).toMatchObject({ state: "executing" });
  });
});

describe("useOperatorInboxCounts", () => {
  it("reads GET /operator/inbox/counts under the inbox key", async () => {
    m.get.mockResolvedValue({ counts: { executing: 2 }, total: 2 });
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useOperatorInboxCounts(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ counts: { executing: 2 }, total: 2 }));
    expect(m.get).toHaveBeenCalledWith("/api/v1/operator/inbox/counts");
    expect(client.getQueryCache().find({ queryKey: ["operator-inbox", "counts"] })).toBeTruthy();
  });
});
