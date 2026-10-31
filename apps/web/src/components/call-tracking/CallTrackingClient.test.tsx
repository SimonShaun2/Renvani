import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  routes: {} as Record<string, () => Promise<unknown>>,
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn()
}));

vi.mock("@/src/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/src/lib/api")>();
  const get = (path: string) => {
    m.get(path);
    const key = Object.keys(m.routes).find((prefix) => path.startsWith(prefix));
    const fn = key ? m.routes[key] : undefined;
    return fn ? fn() : Promise.reject(new Error(`unmocked ${path}`));
  };
  return { ...actual, api: { get, put: m.put, post: m.post, patch: m.post, delete: m.post } };
});

import { ApiError } from "@/src/lib/api";
import { useAuthStore } from "@/src/stores/auth.store";
import { CallTrackingClient } from "./CallTrackingClient";

const BASE = "/api/v1/growth/call-tracking";
const settings = (over: Record<string, unknown> = {}) => ({
  provider: "disabled",
  enabled: false,
  providerReady: false,
  recordingEnabled: false,
  recordingDisclosureEnabled: false,
  consentMode: "all_party",
  recordingNoticeState: null,
  availableProviders: ["disabled"],
  version: 3,
  updatedAt: null,
  ...over
});
const number = { id: "n1", provider: "x", trackingNumber: "+15125550100", label: "Truck wrap", marketingSource: "truck_wrap", marketingCampaign: null, forwardingNumber: "+15125550199", active: true, version: 1, createdAt: "", updatedAt: "" };
const call = (over: Record<string, unknown> = {}) => ({
  id: "c1", trackingNumberId: "n1", provider: "x", callerMasked: "***1234", startedAt: "2026-10-30T15:00:00.000Z", durationSeconds: 95,
  outcome: "missed", leadAttribution: null, recordingRef: null, recordingDisclosurePlayed: false, callerConsent: "unknown", recordingNoticeState: null, createdAt: "", ...over
});

const setRole = (role: string) => useAuthStore.setState({ user: { id: "u1", role } as never });
function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <CallTrackingClient />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  setRole("owner");
  m.get.mockReset();
  m.put.mockReset().mockResolvedValue({ settings: settings() });
  m.post.mockReset();
  m.routes = {
    [`${BASE}/settings`]: () => Promise.resolve({ settings: settings() }),
    [`${BASE}/numbers`]: () => Promise.resolve({ numbers: [] }),
    [`${BASE}/calls`]: () => Promise.resolve({ calls: [] })
  };
});
afterEach(cleanup);

describe("CallTrackingClient", () => {
  it("shows a skeleton while loading", () => {
    m.routes[`${BASE}/settings`] = () => new Promise(() => {});
    const { container } = renderClient();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("shows provider-not-enabled state, caveats and empty lists with no fake data", async () => {
    renderClient();
    expect(await screen.findByText("Provider not enabled")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add tracking number" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/verify that your shop owns the number/)).toBeTruthy();
    expect(await screen.findByText("No tracking numbers yet")).toBeTruthy();
    expect(await screen.findByText("No calls logged yet")).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Add tracking number" })).toBeNull();
    expect((screen.getByLabelText("Track calls from my marketing numbers") as HTMLInputElement).disabled).toBe(true);
  });

  it("shows ErrorState with Retry and refetches", async () => {
    let fail = true;
    m.routes[`${BASE}/settings`] = () => (fail ? Promise.reject(new Error("boom")) : Promise.resolve({ settings: settings() }));
    renderClient();
    expect(await screen.findByText("Could not load call tracking")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Provider not enabled")).toBeTruthy();
  });

  it("blocks recording until disclosure and notice state are set, then saves them together", async () => {
    renderClient();
    const record = (await screen.findByLabelText("Record calls")) as HTMLInputElement;
    expect(record.disabled).toBe(true);
    expect(screen.getByText(/Call recording stays off until/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Play a recording disclosure/));
    expect(record.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("State whose recording notice applies"), { target: { value: "tx" } });
    expect(record.disabled).toBe(false);
    fireEvent.click(record);
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() =>
      expect(m.put).toHaveBeenCalledWith(`${BASE}/settings`, {
        expectedVersion: 3,
        recordingDisclosureEnabled: true,
        consentMode: "all_party",
        recordingNoticeState: "TX",
        recordingEnabled: true
      })
    );
  });

  it("never sends recordingEnabled without the disclosure", async () => {
    m.routes[`${BASE}/settings`] = () => Promise.resolve({ settings: settings({ recordingNoticeState: "CA" }) });
    renderClient();
    expect(await screen.findByText(/Recording notice on file for CA/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(m.put).toHaveBeenCalled());
    expect(m.put.mock.calls[0]?.[1]).toMatchObject({ recordingDisclosureEnabled: false, recordingEnabled: false });
  });

  it("lists numbers and calls with missed and booked-from-call", async () => {
    m.routes[`${BASE}/settings`] = () => Promise.resolve({ settings: settings({ providerReady: true, provider: "acme" }) });
    m.routes[`${BASE}/numbers`] = () => Promise.resolve({ numbers: [number] });
    m.routes[`${BASE}/calls`] = () => Promise.resolve({ calls: [call(), call({ id: "c2", outcome: "answered", leadAttribution: { jobId: "j1" } })] });
    renderClient();
    expect((await screen.findAllByText("Truck wrap")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Provider not enabled")).toBeNull();
    expect(await screen.findByText("Missed")).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByRole("form", { name: "Add tracking number" })).toBeTruthy();
  });

  it.each(["dispatcher", "office", "technician"])("%s sees a restricted state and sends no request", async (role) => {
    setRole(role);
    renderClient();
    expect(await screen.findByText("Owners and admins only")).toBeTruthy();
    expect(m.get).not.toHaveBeenCalled();
    expect(m.put).not.toHaveBeenCalled();
  });
  it("matches the Figma header and layout copy", async () => {
    renderClient();
    expect(screen.getByRole("heading", { level: 1, name: "Call tracking" })).toBeTruthy();
    expect(screen.getByText("See which marketing source made the phone ring, which calls were missed and which calls booked a job.")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Call recording" })).toBeTruthy();
    expect((screen.getByLabelText("State whose recording notice applies") as HTMLInputElement).placeholder).toBe("No state recording notice set yet.");
    expect(screen.getByRole("switch", { name: /Play a recording disclosure/ })).toBeTruthy();
  });

  it("shows the CONFLICT card with Reload on a 409 and refetches settings", async () => {
    m.put.mockReset().mockRejectedValue(new ApiError(409, { message: "conflict" } as never));
    renderClient();
    fireEvent.click(await screen.findByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Someone else changed this.")).toBeTruthy();
    expect(screen.getByText("Conflict")).toBeTruthy();
    const before = m.get.mock.calls.filter(([p]) => p === `${BASE}/settings`).length;
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(m.get.mock.calls.filter(([p]) => p === `${BASE}/settings`).length).toBeGreaterThan(before));
    expect(screen.queryByText("Someone else changed this.")).toBeNull();
  });
});
