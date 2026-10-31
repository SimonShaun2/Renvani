import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ routes: {} as Record<string, () => Promise<unknown>>, get: vi.fn(), post: vi.fn() }));

vi.mock("@/src/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/src/lib/api")>();
  const get = (path: string) => {
    m.get(path);
    const key = Object.keys(m.routes)
      .filter((prefix) => path.startsWith(prefix))
      .sort((a, b) => b.length - a.length)[0];
    const fn = key ? m.routes[key] : undefined;
    return fn ? fn() : Promise.reject(new Error(`unmocked ${path}`));
  };
  return { ...actual, api: { get, post: m.post, put: m.post, patch: m.post, delete: m.post } };
});

import { useAuthStore } from "@/src/stores/auth.store";
import { AgentInbox } from "./AgentInbox";

const ID = "11111111-1111-4111-8111-111111111111";
const item = {
  contractVersion: "0.1.0",
  id: ID,
  state: "awaiting_approval",
  risk: "high",
  recipient: { displayName: "Leah Moore" },
  proposedContent: { channel: "email", body: "Hi Leah, it’s been a while since your last furnace tune-up." },
  consequences: [],
  expiresAt: "2026-11-30T12:00:00.000Z",
  overridePaths: ["approve", "reject", "edit"],
  requiresApproval: true,
  provenance: { agentProduct: "revenue_agent", actionType: "revenue.reactivation.propose", sourceEventIds: [], sourceEvents: [], createdAt: "", reason: "14 months inactive", policyVersion: "v1" }
};
const consent = (blocked: boolean) => ({ actionId: ID, channel: "email", consentScope: "marketing", allowed: !blocked, blocked, reason: "Email opt-in missing", failureCode: blocked ? "consent_missing" : null, policyVersion: "v1" });

const setRole = (role: string) => useAuthStore.setState({ user: { id: "u1", role } as never });
function renderInbox() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><AgentInbox /></QueryClientProvider>);
}

beforeEach(() => {
  setRole("owner");
  m.get.mockReset();
  m.post.mockReset().mockResolvedValue({ created: 2, existing: 1, skipped: 0, proposals: [] });
  m.routes = {
    "/api/v1/operator/inbox": () => Promise.resolve({ items: [item] }),
    "/api/v1/operator/inbox/counts": () => Promise.resolve({ counts: { awaiting_approval: 1, approved: 0, executing: 2, failed: 1, expired: 0, succeeded: 3, cancelled: 0 }, total: 7 }),
    [`/api/v1/ai/revenue-agent/proposals/${ID}/consent`]: () => Promise.resolve(consent(true))
  };
});
afterEach(cleanup);

describe("AgentInbox", () => {
  it("shows the consent-blocked state with Request email consent and Dismiss, and Dismiss rejects", async () => {
    renderInbox();
    expect(await screen.findByText("Consent blocked")).toBeTruthy();
    expect(screen.getByText("Retention · Win-back")).toBeTruthy();
    expect(screen.getByText("Can’t send: Leah hasn’t opted in to email. Email opt-in missing.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Request email consent" }) as HTMLButtonElement).disabled).toBe(true);
    m.post.mockResolvedValueOnce({ ...item, state: "rejected" });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(m.post).toHaveBeenCalledWith(`/api/v1/agent-actions/${ID}/reject`, {}));
  });

  it("shows no consent-blocked state when consent is allowed", async () => {
    m.routes[`/api/v1/ai/revenue-agent/proposals/${ID}/consent`] = () => Promise.resolve(consent(false));
    renderInbox();
    expect(await screen.findByText("Retention · Win-back")).toBeTruthy();
    await waitFor(() => expect(m.get).toHaveBeenCalledWith(`/api/v1/ai/revenue-agent/proposals/${ID}/consent`));
    expect(screen.queryByText("Consent blocked")).toBeNull();
  });

  it("sends limit on Find new proposals and shows its error", async () => {
    m.post.mockRejectedValueOnce(new Error("Forbidden"));
    renderInbox();
    fireEvent.click(await screen.findByRole("button", { name: "Find new proposals" }));
    await waitFor(() => expect(m.post).toHaveBeenCalledWith("/api/v1/ai/revenue-agent/proposals/generate", { limit: 20 }));
    expect(await screen.findByText("Couldn’t find new proposals: Forbidden")).toBeTruthy();
  });

  it.each(["office", "technician"])("%s does not see Find new proposals and sends no consent check", async (role) => {
    setRole(role);
    renderInbox();
    expect(await screen.findByText("Retention · Win-back")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Find new proposals" })).toBeNull();
    expect(m.get.mock.calls.some(([p]) => String(p).includes("/consent"))).toBe(false);
  });

  it("shows ErrorState with Retry when the inbox fails, and recovers", async () => {
    let fail = true;
    m.routes["/api/v1/operator/inbox"] = () => (fail ? Promise.reject(new Error("boom")) : Promise.resolve({ items: [item] }));
    renderInbox();
    expect(await screen.findByText("Couldn’t load the inbox")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("Retention · Win-back")).toBeTruthy();
  });

  it("shows Queued · not sent and Completed tabs with counts from /operator/inbox/counts", async () => {
    renderInbox();
    expect(await screen.findByRole("tab", { name: "Queued · not sent 2" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Completed 3" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Queued · not sent 2" }));
    await waitFor(() => expect(m.get).toHaveBeenCalledWith("/api/v1/operator/inbox?state=executing"));
    fireEvent.click(screen.getByRole("tab", { name: "Completed 3" }));
    await waitFor(() => expect(m.get).toHaveBeenCalledWith("/api/v1/operator/inbox?state=succeeded"));
    expect(m.get.mock.calls.some(([p]) => /state=(executed|rejected)\b/.test(String(p)))).toBe(false);
  });

  it("failed rows show Delivery failure with executionReceipt.error.message", async () => {
    const failed = { ...item, state: "failed", overridePaths: [], executionReceipt: { outcome: "failed", deliveryState: "failed", error: { code: "EXECUTION_FAILED", message: "Execution failed" } } };
    m.routes["/api/v1/operator/inbox"] = () => Promise.resolve({ items: [failed] });
    renderInbox();
    const row = await screen.findByTestId("row-failure");
    expect(row.textContent).toBe("Delivery failureExecution failed");
  });

  it("after execute, follows the returned state (executing → Queued · not sent) and refreshes counts", async () => {
    const approved = { ...item, state: "approved", overridePaths: ["execute"], version: 3 };
    let executed = false;
    m.routes["/api/v1/operator/inbox"] = () => Promise.resolve({ items: [executed ? { ...approved, state: "executing" } : approved] });
    m.routes[`/api/v1/ai/revenue-agent/proposals/${ID}/consent`] = () => Promise.resolve(consent(false));
    renderInbox();
    fireEvent.click(await screen.findByText("Leah Moore"));
    const countsBefore = m.get.mock.calls.filter(([p]) => p === "/api/v1/operator/inbox/counts").length;
    m.post.mockImplementationOnce(() => {
      executed = true;
      return Promise.resolve({ id: ID, state: "executing", executionReceipt: { outcome: "queued", deliveryState: "queued" } });
    });
    fireEvent.click(await screen.findByRole("button", { name: "Execute now" }));
    expect((await screen.findByTestId("action-result")).textContent).toBe("Queued · not sent. Provider delivery is still unconfirmed.");
    expect(screen.getByRole("tab", { selected: true }).textContent).toMatch(/^Queued · not sent/);
    await waitFor(() => expect(m.get.mock.calls.filter(([p]) => p === "/api/v1/operator/inbox/counts").length).toBeGreaterThan(countsBefore));
    expect(screen.queryByText("Completed.")).toBeNull();
  });

  it("after execute fails server-side, shows the error and refetches (no assumed success)", async () => {
    const approved = { ...item, state: "approved", overridePaths: ["execute"], version: 3 };
    m.routes["/api/v1/operator/inbox"] = () => Promise.resolve({ items: [approved] });
    m.routes[`/api/v1/ai/revenue-agent/proposals/${ID}/consent`] = () => Promise.resolve(consent(false));
    renderInbox();
    fireEvent.click(await screen.findByText("Leah Moore"));
    const before = m.get.mock.calls.length;
    m.post.mockRejectedValueOnce(new Error("Execution failed"));
    fireEvent.click(await screen.findByRole("button", { name: "Execute now" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    await waitFor(() => expect(m.get.mock.calls.length).toBeGreaterThan(before));
    expect(screen.queryByTestId("action-result")).toBeNull();
  });

  it("Approve & send only approves (never calls execute)", async () => {
    m.routes[`/api/v1/ai/revenue-agent/proposals/${ID}/consent`] = () => Promise.resolve(consent(false));
    renderInbox();
    fireEvent.click(await screen.findByText("Leah Moore"));
    m.post.mockResolvedValueOnce({ id: ID, state: "approved" });
    const buttons = await screen.findAllByRole("button", { name: "Approve & send" });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(m.post).toHaveBeenCalledWith(`/api/v1/agent-actions/${ID}/approve`, expect.anything(), expect.anything()));
    expect(m.post.mock.calls.some(([p]) => String(p).endsWith("/execute"))).toBe(false);
    expect((await screen.findByTestId("action-result")).textContent).toMatch(/^Approved\. Nothing is sent until you execute it\./);
  });
});
