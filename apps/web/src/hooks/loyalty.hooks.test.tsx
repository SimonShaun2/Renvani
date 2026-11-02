import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/src/lib/api", () => ({ api: { get: m.get } }));

import { reminderCandidatesPath, useLoyaltyReminderCandidates } from "./loyalty.hooks";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  m.get.mockReset();
  m.get.mockResolvedValue({ candidates: [], dryRun: true });
});

describe("loyalty hooks", () => {
  it("builds the query string", () => {
    expect(reminderCandidatesPath({ horizonDays: 14 })).toBe("/api/v1/loyalty/reminder-candidates?horizonDays=14");
    expect(reminderCandidatesPath({ horizonDays: 30, lapsedDays: 365 })).toBe(
      "/api/v1/loyalty/reminder-candidates?horizonDays=30&lapsedDays=365"
    );
  });

  it("GETs candidates, and does not fetch when disabled", async () => {
    const { result } = renderHook(() => useLoyaltyReminderCandidates({ horizonDays: 14 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.get).toHaveBeenCalledWith("/api/v1/loyalty/reminder-candidates?horizonDays=14");
    expect(result.current.data).toEqual({ candidates: [], dryRun: true });
    m.get.mockClear();
    renderHook(() => useLoyaltyReminderCandidates({ horizonDays: 14 }, false), { wrapper: wrapper() });
    expect(m.get).not.toHaveBeenCalled();
  });
});
