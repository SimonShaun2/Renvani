// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  role: "owner" as string | null,
  status: {} as Record<string, unknown>,
  mut: {} as Record<string, unknown>,
  enabledCalls: [] as boolean[],
  mutate: vi.fn(),
  reset: vi.fn(),
  refetch: vi.fn()
}));

vi.mock("@/src/stores/auth.store", () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: m.role ? { role: m.role } : null }) }));
vi.mock("@/src/hooks/google-business-profile.hooks", () => ({
  useGoogleBusinessProfileStatus: (enabled: boolean) => {
    m.enabledCalls.push(enabled);
    return { isLoading: false, isError: false, isFetching: false, data: undefined, refetch: m.refetch, ...(enabled ? m.status : {}) };
  },
  useSetGoogleBusinessProfileOptIn: () => ({ mutate: m.mutate, reset: m.reset, isPending: false, isError: false, ...m.mut })
}));

import { GoogleBusinessProfileSettings } from "./GoogleBusinessProfileSettings";

const data = (optIn: boolean, configured = false) => ({
  googleBusinessProfile: { optIn, provider: configured ? "google" : "disabled", configured, updatedAt: optIn ? "2026-10-31T18:00:00.000Z" : null }
});

beforeEach(() => {
  m.role = "owner";
  m.status = { data: data(false) };
  m.mut = {};
  m.enabledCalls = [];
  m.mutate.mockReset();
  m.refetch.mockReset();
});
afterEach(cleanup);

describe("GoogleBusinessProfileSettings", () => {
  it("dispatcher sees no-access and nothing is fetched", () => {
    m.role = "dispatcher";
    render(<GoogleBusinessProfileSettings />);
    expect(screen.getByText(/Only an owner or admin/)).toBeTruthy();
    expect(m.enabledCalls.every((e) => !e)).toBe(true);
  });

  it("shows not connected + not opted in honestly, and opts in", () => {
    render(<GoogleBusinessProfileSettings />);
    expect(screen.getByTestId("gbp-connection").textContent).toBe("Not connected yet");
    expect(screen.getByTestId("gbp-connection-detail").textContent).toMatch(/no profile details or Google reviews/);
    expect(screen.getByTestId("gbp-optin").textContent).toBe("Not opted in");
    fireEvent.click(screen.getByRole("button", { name: "Opt in" }));
    expect(m.mutate).toHaveBeenCalledWith(true);
  });

  it("opted in shows Opt out; disabled while saving", () => {
    m.status = { data: data(true, true) };
    m.mut = { isPending: true };
    render(<GoogleBusinessProfileSettings />);
    expect(screen.getByTestId("gbp-connection").textContent).toBe("Provider connected");
    const btn = screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/Last changed/)).toBeTruthy();
  });

  it("save error offers Reload", () => {
    m.mut = { isError: true };
    render(<GoogleBusinessProfileSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(m.reset).toHaveBeenCalled();
    expect(m.refetch).toHaveBeenCalled();
  });

  it("load error state", () => {
    m.status = { isError: true };
    render(<GoogleBusinessProfileSettings />);
    expect(screen.getByText("Couldn't load your Google Business Profile settings")).toBeTruthy();
  });
});
