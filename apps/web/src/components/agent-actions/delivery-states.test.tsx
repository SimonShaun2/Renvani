import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { OperatorInboxItem } from "@fsm/types";

import { DeliveryStates } from "./DeliveryStates";
import { DELIVERY_STEPS, DELIVERY_TOKENS, deliveryBadge, deliveryEvidence, deliverySteps, deliveryToken, sortApprovals } from "./delivery-states.config";

const item = (over: Partial<OperatorInboxItem> = {}): OperatorInboxItem => ({
  contractVersion: "0.1.0",
  id: "11111111-1111-4111-8111-111111111d48",
  state: "awaiting_approval",
  risk: "medium",
  recipient: { displayName: "J. Morgan" },
  proposedContent: { channel: "sms", body: "Hi" },
  consequences: [],
  expiresAt: "2026-11-30T12:00:00.000Z",
  overridePaths: ["approve", "reject"],
  requiresApproval: true,
  provenance: { agentProduct: "revenue_agent", actionType: "revenue.estimate_followup.propose", sourceEventIds: [], sourceEvents: [], createdAt: "", policyVersion: "operating-v1" },
  ...over
});
const statuses = (i: OperatorInboxItem) => deliverySteps(i).map((s) => s.status);

describe("delivery states (Figma 331:4230 / 341:4255)", () => {
  it("has the six steps and the #380 code tokens", () => {
    expect(DELIVERY_STEPS.map((s) => s.label)).toEqual(["Prepared", "Approved", "Queued", "Provider accepted", "Delivered", "Business outcome"]);
    expect(DELIVERY_TOKENS).toEqual(["queued", "provider_accepted", "delivered", "failed"]);
  });

  it("maps pending, approved and queued", () => {
    expect(statuses(item())).toEqual(["done", "current", "pending", "pending", "pending", "pending"]);
    expect(statuses(item({ state: "approved" }))).toEqual(["done", "done", "current", "pending", "pending", "pending"]);
    expect(deliveryBadge(item({ state: "approved" })).label).toBe("Approved");
    const queued = item({ state: "executing", executionReceipt: { outcome: "queued", deliveryState: "queued" } });
    expect(deliveryToken(queued)).toBe("queued");
    expect(statuses(queued)).toEqual(["done", "done", "done", "current", "pending", "pending"]);
    expect(deliveryBadge(queued).label).toBe("Queued · not sent");
  });

  it("provider_accepted and delivered; business outcome is never auto-completed", () => {
    expect(statuses(item({ state: "executing", executionReceipt: { deliveryState: "provider_accepted" } }))).toEqual(["done", "done", "done", "done", "current", "pending"]);
    const delivered = item({ state: "succeeded", executionReceipt: { deliveryState: "delivered", providerMessageId: "SM123" } });
    expect(statuses(delivered)).toEqual(["done", "done", "done", "done", "done", "current"]);
    expect(deliveryEvidence(delivered)).toMatchObject({ providerReceipt: "SM123", delivered: true });
  });

  it("never shows a bare 'succeeded' receipt as delivered (stub until #380)", () => {
    const legacy = item({ state: "succeeded", executionReceipt: { outcome: "succeeded", emittedEventIds: [] } });
    expect(deliveryToken(legacy)).toBe("queued");
    expect(deliveryEvidence(legacy).delivered).toBe(false);
  });

  it("failed shows the failure badge", () => {
    const failed = item({ state: "failed", executionReceipt: { outcome: "failed" } });
    expect(deliveryToken(failed)).toBe("failed");
    expect(deliveryBadge(failed)).toMatchObject({ label: "Delivery failure", tone: "red" });
    expect(statuses(failed)).toEqual(["done", "done", "pending", "pending", "pending", "pending"]);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}><DeliveryStates item={failed} /></QueryClientProvider>
    );
    expect(html).toContain('data-testid="failure-badge"');
    expect(html).toContain("No evidence of delivery yet.");
    expect(html).toContain("operating-v1");
  });

  it("renders the Figma copy without a failure badge when not failed", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}><DeliveryStates item={item({ state: "approved" })} /></QueryClientProvider>
    );
    expect(html).toContain("Estimate follow-up");
    expect(html).toContain("Inspect event trail");
    expect(html).not.toContain('data-testid="failure-badge"');
    expect(html).not.toMatch(/booking fee|platform fee/i);
  });

  it("lists estimate follow-ups first, otherwise keeps API order", () => {
    const a = item({ id: "a", provenance: { ...item().provenance, actionType: "revenue.reactivation.propose" } });
    const b = item({ id: "b" });
    const c = item({ id: "c", provenance: { ...item().provenance, actionType: "service.job_brief.propose" } });
    expect(sortApprovals([a, b, c]).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
});
