import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/src/lib/api", () => ({ api: { get: m.get, put: m.put } }));

import { gbpKeys, useGoogleBusinessProfileStatus, useSetGoogleBusinessProfileOptIn } from "./google-business-profile.hooks";

const resp = (optIn: boolean) => ({ googleBusinessProfile: { optIn, provider: "disabled", configured: false, updatedAt: null } });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}

beforeEach(() => {
  m.get.mockReset().mockResolvedValue(resp(false));
  m.put.mockReset().mockResolvedValue(resp(true));
});

describe("google business profile hooks", () => {
  it("GETs status, not when disabled", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useGoogleBusinessProfileStatus(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.get).toHaveBeenCalledWith("/api/v1/integrations/google-business-profile");
    m.get.mockClear();
    renderHook(() => useGoogleBusinessProfileStatus(false), { wrapper: setup().wrapper });
    expect(m.get).not.toHaveBeenCalled();
  });

  it("PUTs opt-in, stores result and refetches", async () => {
    const { client, wrapper } = setup();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useSetGoogleBusinessProfileOptIn(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(true);
    });
    expect(m.put).toHaveBeenCalledWith("/api/v1/integrations/google-business-profile/opt-in", { optIn: true });
    expect(client.getQueryData(gbpKeys.status)).toEqual(resp(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: gbpKeys.status });
  });
});
