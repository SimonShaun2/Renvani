import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  routes: {} as Record<string, () => Promise<unknown>>,
  post: vi.fn(),
  patch: vi.fn(),
  fetch: vi.fn()
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");
  const MOTION_PROPS = ["initial", "animate", "exit", "transition", "layout", "whileHover", "whileTap", "variants"];
  const strip = (props: Record<string, unknown>) => Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.includes(key)));
  const motion = new Proxy({}, { get: (_t, tag: string) => React.forwardRef((props: Record<string, unknown>, ref) => React.createElement(tag, { ...strip(props), ref })) });
  return { motion, AnimatePresence: ({ children }: { children: unknown }) => children, useReducedMotion: () => true };
});
vi.mock("@/src/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/src/lib/api")>();
  const get = (path: string) => {
    const key = Object.keys(m.routes).sort((a, b) => b.length - a.length).find((prefix) => path.startsWith(prefix));
    const fn = key ? m.routes[key] : undefined;
    return fn ? fn() : Promise.reject(new Error(`unmocked ${path}`));
  };
  return { ...actual, authorizedFetch: m.fetch, api: { get, post: m.post, patch: m.patch, put: m.post, delete: m.post } };
});

import { ApiError } from "@/src/lib/api";
import { useAuthStore } from "@/src/stores/auth.store";
import { GrowthCheckReviewClient } from "./GrowthCheckReviewClient";
import { ReportEditor } from "./ReportEditor";

const B = "/api/v1/growth-check";
const content = { title: "Acme HVAC growth check", businessName: "Acme HVAC", serviceArea: "Round Rock, TX", intro: null, internalNotes: "call Tue", opportunities: [], excludedFindingIds: [] };
const draft = (over: Record<string, unknown> = {}) => ({ id: "d1", scanId: "s1", version: 2, content, approved: false, approvedVersion: null, approvedByUserId: null, approvedAt: null, createdByUserId: "u1", createdAt: "2026-10-30T15:00:00.000Z", updatedAt: "2026-10-30T15:00:00.000Z", ...over });
const preview = (approved: boolean) => ({
  draftId: "d1", version: 2, approved, contentHash: "abc123def4567890", html: "", text: "Acme HVAC report text",
  report: { title: "Acme HVAC growth check", business: { name: "Acme HVAC", serviceArea: "Round Rock, TX", website: "https://acmehvac.example" }, intro: null, source: { scanId: "s1", rubricId: "home-services", rubricVersion: "1", scannedAt: "" },
    whatsWorking: [{ findingId: "f2", areaId: "gbp", checkLabel: "Google Business Profile", summary: "Hours and phone match", evidenceLabel: "observed", sourceUrl: "" }],
    opportunities: [{ findingId: "f1", areaId: "local", checkLabel: "Service-area pages", summary: "", evidenceLabel: "needs_confirmation", sourceUrl: "", rank: 1, headline: "Add a Round Rock service-area page", nextStep: "Publish a page for furnace repair in Round Rock", score: { impact: 3, evidence: 2, actionability: 3, total: 8 } }],
    needsConfirmationCount: 1, draftVersion: 2 }
});
const share = (over: Record<string, unknown> = {}) => ({ id: "sh1", draftId: "d1", draftVersion: 2, contentHash: "abc", createdByUserId: "u1", createdAt: "2026-10-30T16:00:00.000Z", expiresAt: null, revokedAt: null, revokedByUserId: null, status: "active", ...over });
const apiErr = (status: number, reason: string, extra: Record<string, string> = {}) => new ApiError(status, { error: "CONFLICT" as never, message: reason, fields: { reason, ...extra } });

let approved = false;
function routes() {
  m.routes = {
    [`${B}/scans/s1/report-draft`]: () => Promise.resolve({ draft: draft({ approved, approvedVersion: approved ? 2 : null }) }),
    [`${B}/report-drafts/d1`]: () => Promise.resolve({ draft: draft({ approved, approvedVersion: approved ? 2 : null }), history: [{ id: "r1", draftId: "d1", version: 1, action: "create", actorUserId: "u1", changedFields: [], previous: null, next: content, createdAt: "2026-10-30T15:00:00.000Z" }] }),
    [`${B}/report-drafts/d1/preview`]: () => Promise.resolve(preview(approved)),
    [`${B}/report-drafts/d1/shares`]: () => Promise.resolve({ shares: [share()] }),
    [`${B}/scans/s1/findings`]: () => Promise.resolve({ scanId: "s1", findings: [] })
  };
}
function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><ReportEditor scanId="s1" /></QueryClientProvider>);
}

beforeEach(() => {
  approved = false;
  useAuthStore.setState({ user: { id: "u1", role: "owner" } as never });
  m.post.mockReset();
  m.patch.mockReset();
  m.fetch.mockReset();
  routes();
});
afterEach(cleanup);

describe("ReportEditor", () => {
  it("shows a skeleton while loading", () => {
    m.routes[`${B}/scans/s1/report-draft`] = () => new Promise(() => {});
    const { container } = renderEditor();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("shows the empty state on 404 and starts a report with an idempotency key", async () => {
    m.routes[`${B}/scans/s1/report-draft`] = () => Promise.reject(new ApiError(404, { error: "NOT_FOUND" as never, message: "nf" }));
    m.post.mockResolvedValue({ draft: draft(), revision: {}, replayed: false });
    renderEditor();
    expect(await screen.findByText("No report yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start report" }));
    await waitFor(() => expect(m.post).toHaveBeenCalledWith(`${B}/scans/s1/report-draft`, { idempotencyKey: expect.any(String) }));
  });

  it("shows an error with Retry and recovers", async () => {
    let fail = true;
    m.routes[`${B}/scans/s1/report-draft`] = () => (fail ? Promise.reject(new Error("boom")) : Promise.resolve({ draft: draft() }));
    renderEditor();
    expect(await screen.findByText("Couldn’t load the report")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByRole("form", { name: "Edit report" })).toBeTruthy();
  });

  it("renders the preview without internal notes, with evidence labels", async () => {
    renderEditor();
    const prev = await screen.findByRole("article", { name: "Report preview" });
    expect(await within(prev).findByText("Add a Round Rock service-area page")).toBeTruthy();
    expect(prev.textContent).toContain("Hours and phone match");
    expect(prev.textContent).not.toContain("call Tue");
  });

  it("sends only changed fields with expectedVersion and idempotencyKey, and shows the stale-version refresh state", async () => {
    m.patch.mockRejectedValueOnce(apiErr(409, "stale_version", { currentVersion: "3" }));
    renderEditor();
    const title = await screen.findByLabelText("Report title");
    fireEvent.change(title, { target: { value: "Acme HVAC — fall check" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(m.patch).toHaveBeenCalledWith(`${B}/report-drafts/d1`, { title: "Acme HVAC — fall check", expectedVersion: 2, idempotencyKey: expect.any(String) })
    );
    expect(await screen.findByText(/Someone else changed this report \(now version 3\)/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.queryByText(/Someone else changed/)).toBeNull());
  });

  it("approves the current version after confirmation", async () => {
    m.post.mockResolvedValue({ draft: draft({ approved: true }), revision: {}, replayed: false });
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Approve version 2" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(m.post).toHaveBeenCalledWith(`${B}/report-drafts/d1/approve`, { expectedVersion: 2, idempotencyKey: expect.any(String) }));
  });

  it("blocks export until approved, and shows the state on a 409 not_approved", async () => {
    renderEditor();
    expect(await screen.findByText("Approve the current version to export or copy this report.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Export Markdown" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    approved = true;
    m.fetch.mockResolvedValue(new Response(JSON.stringify({ error: "CONFLICT", message: "nope", fields: { reason: "not_approved" } }), { status: 409 }));
    renderEditor();
    const exportBtn = await screen.findByRole("button", { name: "Export HTML" });
    await waitFor(() => expect((exportBtn as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(exportBtn);
    await waitFor(() => expect(m.fetch).toHaveBeenCalledWith(`${B}/report-drafts/d1/export?format=html`));
    expect(await screen.findByText("Approve the current version to export or copy this report.")).toBeTruthy();
  });

  it("shows a new share token once with a copy button, then never again", async () => {
    approved = true;
    m.post.mockResolvedValue({ share: share({ id: "sh2" }), token: "tok_ONCE_123456", replayed: false });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderEditor();
    const create = await screen.findByRole("button", { name: /Create share link/ });
    await waitFor(() => expect((create as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(create);
    await waitFor(() => expect(m.post).toHaveBeenCalledWith(`${B}/report-drafts/d1/shares`, { expectedVersion: 2, expiresInDays: 30, idempotencyKey: expect.any(String) }));
    expect(await screen.findByText("tok_ONCE_123456")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("tok_ONCE_123456"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText("tok_ONCE_123456")).toBeNull();
    // a replay returns token null: nothing to show
    m.post.mockResolvedValue({ share: share(), token: null, replayed: true });
    fireEvent.click(screen.getByRole("button", { name: /Create share link/ }));
    expect(await screen.findByText(/Its code can’t be shown again/)).toBeTruthy();
  });

  it("revokes a share after confirmation", async () => {
    m.post.mockResolvedValue({ share: share({ status: "revoked" }), alreadyRevoked: false });
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
    const dialogBtns = await screen.findAllByRole("button", { name: "Revoke" });
    fireEvent.click(dialogBtns[dialogBtns.length - 1]!);
    await waitFor(() => expect(m.post).toHaveBeenCalledWith(`${B}/report-shares/sh1/revoke`, {}));
  });

  it("shows delivery as not enabled and never calls the delivery endpoint", async () => {
    renderEditor();
    expect(await screen.findByText(/Delivery isn’t enabled yet/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Email the report" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Text a report link" }) as HTMLButtonElement).disabled).toBe(true);
    expect(m.post.mock.calls.some(([p]) => String(p).includes("/deliveries"))).toBe(false);
  });
});

describe("Report role gating", () => {
  it.each(["dispatcher", "technician"])("%s cannot reach the report editor", async (role) => {
    useAuthStore.setState({ user: { id: "u1", role } as never });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><GrowthCheckReviewClient /></QueryClientProvider>);
    expect(await screen.findByText("Owners and admins only")).toBeTruthy();
    expect(screen.queryByText("Owner report")).toBeNull();
  });
});
