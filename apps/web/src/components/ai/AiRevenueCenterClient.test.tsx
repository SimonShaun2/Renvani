import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiRecommendationDetail, RevenueSummary } from "@fsm/types";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  propose: vi.fn(),
  push: vi.fn(),
  recommendations: [] as AiRecommendationDetail[]
}));

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => searchParams
}));

vi.mock("framer-motion", () => ({ motion: { div: "div" } }));

vi.mock("@/src/hooks/ai-revenue.hooks", () => ({
  useActionRecommendation: () => ({ mutateAsync: mocks.action, isPending: false, variables: undefined }),
  useDismissRecommendation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSnoozeRecommendation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRecommendations: () => ({
    data: { data: mocks.recommendations, page: 1, totalPages: 1 },
    isLoading: false,
    isError: false,
    refetch: vi.fn()
  })
}));

const summary: RevenueSummary = {
  dormantCustomers: { count: 0, estimatedRevenue: "0.00", topRecommendations: [] },
  unsoldEstimates: { count: 0, totalValue: "0.00", topRecommendations: [] },
  unpaidInvoices: { count: 0, totalValue: "0.00", topRecommendations: [] },
  agingAssets: { count: 0, estimatedRevenue: "0.00", topRecommendations: [] },
  maintenancePlanOpportunities: { count: 0, estimatedRevenue: "0.00", topRecommendations: [] },
  totalOpportunityValue: "0.00",
  generatedAt: "2026-11-01T12:00:00.000Z",
  fromCache: false
};

vi.mock("@/src/hooks/dashboard.hooks", () => ({
  useRevenueSummary: () => ({ data: summary, isLoading: false, isError: false, refetch: vi.fn() })
}));

vi.mock("@/src/hooks/revenue-proposals.hooks", () => ({
  useProposeRecommendation: () => ({ mutateAsync: mocks.propose, isPending: false, variables: undefined })
}));

import { AiRevenueCenterClient } from "./AiRevenueCenterClient";

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

describe("AiRevenueCenterClient proposal wiring", () => {
  it("creates an approval-gated proposal for supported Revenue recommendations", async () => {
    const item = recommendation("unpaid_invoice");
    mocks.recommendations = [item];
    render(<AiRevenueCenterClient />);

    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    await waitFor(() => expect(mocks.propose).toHaveBeenCalledWith(item.id));
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/command-center/approvals");
  });

  it("preserves the existing direct action for unsupported recommendation types", async () => {
    const item = recommendation("aging_asset");
    mocks.recommendations = [item];
    render(<AiRevenueCenterClient />);

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

  it("shows proposal failures and does not navigate", async () => {
    mocks.recommendations = [recommendation("reactivation")];
    mocks.propose.mockRejectedValueOnce(new Error("Proposal creation failed"));
    render(<AiRevenueCenterClient />);

    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Proposal creation failed");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
