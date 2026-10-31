import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ routes: {} as Record<string, () => Promise<unknown>>, get: vi.fn(), post: vi.fn() }));

vi.mock("@/src/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/src/lib/api")>();
  const get = (path: string) => {
    m.get(path);
    const key = Object.keys(m.routes).sort((a, b) => b.length - a.length).find((prefix) => path.startsWith(prefix));
    const fn = key ? m.routes[key] : undefined;
    return fn ? fn() : Promise.reject(new Error(`unmocked ${path}`));
  };
  return { ...actual, api: { get, post: m.post, put: m.post, patch: m.post, delete: m.post } };
});

import { useAuthStore } from "@/src/stores/auth.store";
import { GrowthCheckReviewClient } from "./GrowthCheckReviewClient";

const B = "/api/v1/growth-check";
const state = (over: Record<string, unknown> = {}) => ({ status: "fail", summary: "No service-area page for Round Rock", reviewState: "machine", ownerValidation: "not_requested", ownerConfirmedFact: false, lastNote: null, ...over });
const finding = { id: "f1", scanId: "s1", areaId: "local", checkId: "service_area_pages", checkLabel: "Service-area pages", sourceUrl: "https://acmehvac.example", observedAt: "2026-10-29T15:00:00.000Z", machine: { status: "fail", confidence: "medium", summary: "No service-area page for Round Rock" }, current: state(), revision: 2, updatedAt: "" };
const scan = { id: "s1", targetUrl: "https://acmehvac.example", rubricId: "home-services", rubricVersion: "1", status: "completed", createdAt: "2026-10-29T15:00:00.000Z", findingCount: 4, reviewedFindingCount: 1, revisionCount: 2, ownerValidationRequested: 1, ownerConfirmed: 0, lastChangedAt: null };
const rev = { id: "r1", findingId: "f1", revision: 1, action: "edit", actorUserId: "u2", reason: "Page exists under /areas", note: null, previous: state(), next: state({ status: "pass", reviewState: "edited" }), changedFields: ["status", "reviewState"], createdAt: "2026-10-30T15:00:00.000Z" };

const setRole = (role: string) => useAuthStore.setState({ user: { id: "u1", role } as never });
function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><GrowthCheckReviewClient /></QueryClientProvider>);
}
async function openFinding() {
  fireEvent.click(await screen.findByRole("button", { name: /acmehvac\.example/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Service-area pages/ }));
  await screen.findByLabelText("Finding detail");
}

beforeEach(() => {
  setRole("owner");
  m.get.mockReset();
  m.post.mockReset().mockResolvedValue({ finding, revision: rev, replayed: false });
  m.routes = {
    [`${B}/scans?`]: () => Promise.resolve({ scans: [scan] }),
    [`${B}/scans/s1/findings`]: () => Promise.resolve({ scanId: "s1", rubricId: "home-services", rubricVersion: "1", findings: [finding] }),
    [`${B}/findings/f1`]: () => Promise.resolve({ finding, history: [rev] })
  };
});
afterEach(cleanup);

describe("GrowthCheckReviewClient", () => {
  it("shows a skeleton while loading", () => {
    m.routes[`${B}/scans?`] = () => new Promise(() => {});
    const { container } = renderClient();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("shows the empty state", async () => {
    m.routes[`${B}/scans?`] = () => Promise.resolve({ scans: [] });
    renderClient();
    expect(await screen.findByText("No Growth Checks yet")).toBeTruthy();
  });

  it("shows ErrorState with Retry and recovers", async () => {
    let fail = true;
    m.routes[`${B}/scans?`] = () => (fail ? Promise.reject(new Error("x")) : Promise.resolve({ scans: [scan] }));
    renderClient();
    expect(await screen.findByText("Could not load Growth Checks")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Prior checks")).toBeTruthy();
  });

  it("lists scans and findings, and shows detail with machine observation and history diff", async () => {
    renderClient();
    expect(await screen.findByText(/1\/4 reviewed/)).toBeTruthy();
    await openFinding();
    expect(screen.getByText("Machine observation (kept as found)")).toBeTruthy();
    expect(screen.getByText(/Hypothesis — not confirmed by the owner/)).toBeTruthy();
    expect(screen.getByText("Reason: Page exists under /areas")).toBeTruthy();
    expect(screen.getAllByText("Needs work").some((el) => el.tagName === "DEL")).toBe(true);
    expect(screen.getAllByText("Pass").some((el) => el.tagName === "INS")).toBe(true);
  });

  it("sends a review action with expectedRevision and idempotency key", async () => {
    renderClient();
    await openFinding();
    fireEvent.click(screen.getByRole("button", { name: "Mark not applicable" }));
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Reason \(required\)/), { target: { value: "We don't serve that area" } });
    fireEvent.click(save);
    await waitFor(() => expect(m.post).toHaveBeenCalled());
    const [path, body] = m.post.mock.calls[0] ?? [];
    expect(path).toBe(`${B}/findings/f1/reviews`);
    expect(body).toMatchObject({ action: "mark_not_applicable", expectedRevision: 2, reason: "We don't serve that area" });
    expect(String(body.idempotencyKey).length).toBeGreaterThanOrEqual(8);
  });

  it("owner sees and can send owner confirm", async () => {
    renderClient();
    await openFinding();
    fireEvent.click(screen.getByRole("button", { name: "Owner confirms" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.post.mock.calls[0]?.[1]).toMatchObject({ action: "owner_confirm" }));
  });

  it("admin sees no owner-only actions and sends no owner request", async () => {
    setRole("admin");
    renderClient();
    await openFinding();
    for (const name of ["Owner confirms", "Owner rejects", "Owner cannot answer"]) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.getByRole("button", { name: "Request owner validation" })).toBeTruthy();
    expect(m.post).not.toHaveBeenCalled();
  });

  it.each(["dispatcher", "office", "technician"])("%s sees a restricted state and sends no request", async (role) => {
    setRole(role);
    renderClient();
    expect(await screen.findByText("Owners and admins only")).toBeTruthy();
    expect(m.get).not.toHaveBeenCalled();
  });
});
