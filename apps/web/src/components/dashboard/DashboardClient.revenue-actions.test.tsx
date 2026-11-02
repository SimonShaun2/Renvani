import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiRecommendationDetail } from "@fsm/types";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  propose: vi.fn(),
  push: vi.fn(),
  recommendations: [] as AiRecommendationDetail[]
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push })
}));

vi.mock("framer-motion", () => ({ motion: { div: "div" } }));

vi.mock("@/src/hooks/ai-revenue.hooks", () => ({
  useActionRecommendation: () => ({ mutateAsync: mocks.action, isPending: false, variables: undefined }),
  useRecommendations: () => ({
    data: { data: mocks.recommendations, page: 1, totalPages: 1 },
    isLoading: false,
    isError: false,
    refetch: vi.fn()
  })
}));

vi.mock("@/src/hooks/revenue-proposals.hooks", () => ({
  useProposeRecommendation: () => ({ mutateAsync: mocks.propose, isPending: false, variables: undefined })
}));

import { SuggestedActions } from "./DashboardClient";

function recommendation(type: AiRecommendationDetail["type"]): AiRecommendationDetail {
  const now = new Date("2026-11-01T12:00:00.000Z");
  return {
    id: `rec-${type}`,
    companyId: "company-1",
    type,
    status: "pending",
    customerId: "customer-1",
    propertyId: null,
    assetId: null,
    jobId: null,
    estimateId: null,
    invoiceId: null,
    estimatedRevenue: "125.00",
    headline: "Revenue opportunity",
    body: "Follow up with this customer.",
    suggestedAction: null,
    suggestedMessage: "Hello",
    urgencyScore: 80,
    confidenceScore: 90,
    actionedAt: null,
    actionedById: null,
    dismissedAt: null,
    snoozedUntil: null,
    expiresAt: null,
    sourceEventIds: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    customer: { id: "customer-1", firstName: "Taylor", lastName: "Reed", phone: null },
    asset: null,
    job: null,
    estimate: null,
    invoice: null
  };
}

beforeEach(() => {
  mocks.action.mockReset().mockResolvedValue({});
  mocks.propose.mockReset().mockResolvedValue({});
  mocks.push.mockReset();
  mocks.recommendations = [];
});

afterEach(cleanup);

describe("Dashboard SuggestedActions Revenue proposal wiring", () => {
  it("creates an approval-gated proposal for supported recommendations", async () => {
    const item = recommendation("unpaid_invoice");
    mocks.recommendations = [item];
    render(<SuggestedActions />);

    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    await waitFor(() => expect(mocks.propose).toHaveBeenCalledWith(item.id));
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/command-center/approvals");
  });

  it("preserves direct actions for unsupported recommendations", async () => {
    const item = recommendation("aging_asset");
    mocks.recommendations = [item];
    render(<SuggestedActions />);

    fireEvent.click(screen.getByRole("button", { name: "Create Estimate" }));

    await waitFor(() =>
      expect(mocks.action).toHaveBeenCalledWith({
        id: item.id,
        input: { actionTaken: "Create Estimate" }
      })
    );
    expect(mocks.propose).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows proposal failures without navigating", async () => {
    mocks.recommendations = [recommendation("reactivation")];
    mocks.propose.mockRejectedValue(new Error("Proposal rollout is disabled"));
    render(<SuggestedActions />);

    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Proposal rollout is disabled");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
