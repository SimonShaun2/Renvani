import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  resolveBearerToken: vi.fn()
}));

vi.mock("@/src/lib/api", () => ({
  api: { get: m.get, post: m.post },
  resolveBearerToken: m.resolveBearerToken
}));

vi.mock("@/src/lib/api-base-url", () => ({ API_BASE_URL: "https://api.example.test" }));

import { useDispatchView } from "./dispatch.hooks";
import { useDispatchStore } from "@/src/stores/dispatch.store";

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly close = vi.fn();
  readonly listeners = new Map<string, EventListener>();
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, listener);
  }
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useDispatchView stream fallback", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    m.get.mockResolvedValue({ technicians: [] });
    useDispatchStore.getState().setStreamLive(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps polling enabled and reports the failure when token resolution rejects", async () => {
    const authError = new Error("Clerk token sk_test_standalone for customer@example.com unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.resolveBearerToken.mockRejectedValue(authError);

    const { wrapper } = setup();
    const { unmount } = renderHook(() => useDispatchView("2026-11-01"), { wrapper });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Dispatch stream authorization failed; falling back to polling"
      );
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/sk_test_standalone|customer@example\.com/);
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(useDispatchStore.getState().streamLive).toBe(false);
    unmount();
  });

  it("uses the resolved bearer token and marks the stream live only after it opens", async () => {
    m.resolveBearerToken.mockResolvedValue({ token: "legacy token/+", source: "legacy" });

    const { wrapper } = setup();
    const { unmount } = renderHook(() => useDispatchView("2026-11-01"), { wrapper });

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    const stream = FakeEventSource.instances[0];
    expect(stream?.url).toBe(
      "https://api.example.test/api/v1/dispatch/stream?date=2026-11-01&access_token=legacy+token%2F%2B"
    );
    expect(useDispatchStore.getState().streamLive).toBe(false);

    act(() => stream?.onopen?.(new Event("open")));
    expect(useDispatchStore.getState().streamLive).toBe(true);

    act(() => stream?.onerror?.(new Event("error")));
    expect(useDispatchStore.getState().streamLive).toBe(false);
    expect(stream?.close).toHaveBeenCalledTimes(1);
    unmount();
  });
});
