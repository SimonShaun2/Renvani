import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiRecommendationDetail, PaginatedAiRecommendations, RevenueSummary } from "@fsm/types";

type QuerySnapshot<T> = { data: T | null | undefined; isLoading: boolean; isError: boolean };

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  propose: vi.fn(),
  push: vi.fn(),
  summary: { data: undefined, isLoading: false, isError: false } as QuerySnapshot<RevenueSummary>,
  recommendations: { data: undefined, isLoading: false, isError: false } as QuerySnapshot<PaginatedAiRecommendations>,
  refetchSummary: vi.fn<() => Promise<QuerySnapshot<RevenueSummary>>>(),
  refetchRecommendations: vi.fn<() => Promise<QuerySnapshot<PaginatedAiRecommendations>>>()
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
  useRecommendations: () => ({ ...mocks.recommendations, refetch: mocks.refetchRecommendations })
}));

vi.mock("@/src/hooks/dashboard.hooks", () => ({
  useRevenueSummary: () => ({ ...mocks.summary, refetch: mocks.refetchSummary })
}));

vi.mock("@/src/hooks/revenue-proposals.hooks", () => ({
  useProposeRecommendation: () => ({ mutateAsync: mocks.propose, isPending: false, variables: undefined })
}));

import { AiRevenueCenterClient } from "./AiRevenueCenterClient";

function zeroSummary(): RevenueSummary {
  return {
    dormantCustomers: { count: 0, estimatedRevenue: "0.00", topRecommendations: [] },
    unsoldEstimates: { count: 0, totalValue: "0.00", topRecommendations: [] },
    unpaidInvoices: { count: 0, totalValue: "0.00", topRecommendations: [] },
    agingAssets: { count: 0, estimatedRevenue: "0.00", topRecommendations: [] },
    maintenancePlanOpportunities: { count: 0, estimatedRevenue: "0.00", topRecommendations: [] },
    totalOpportunityValue: "0.00",
    generatedAt: "2026-11-01T12:00:00.000Z",
    fromCache: false
  };
}

function pageOf(data: AiRecommendationDetail[] = [], totalPages = data.length ? 1 : 0): PaginatedAiRecommendations {
  return { data, page: 1, limit: 25, total: totalPages > 1 ? 26 : data.length, totalPages };
}

function ready<T>(data: T): QuerySnapshot<T> {
  return { data, isLoading: false, isError: false };
}

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    resolve(value: T) {
      if (!resolve) throw new Error("Deferred promise was not initialized.");
      resolve(value);
    },
    reject(reason: unknown) {
      if (!reject) throw new Error("Deferred promise was not initialized.");
      reject(reason);
    }
  };
}

function recommendation(type: AiRecommendationDetail["type"]): AiRecommendationDetail {
  const now = new Date("2026-11-01T12:00:00.000Z");
  return {
    id: "rec-" + type,
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

function refreshButton() {
  return screen.getByRole("button", { name: "Refresh saved revenue opportunities" });
}

function summaryRegion() {
  const region = screen.getByText("Identified revenue opportunity").closest("section");
  if (!region) throw new Error("Revenue summary section was not rendered.");
  return within(region);
}

beforeEach(() => {
  mocks.action.mockReset().mockResolvedValue({});
  mocks.propose.mockReset().mockResolvedValue({});
  mocks.push.mockReset();
  mocks.summary = ready(zeroSummary());
  mocks.recommendations = ready(pageOf());
  mocks.refetchSummary.mockReset().mockImplementation(async () => mocks.summary);
  mocks.refetchRecommendations.mockReset().mockImplementation(async () => mocks.recommendations);
  for (const key of Array.from(searchParams.keys())) searchParams.delete(key);
});

afterEach(cleanup);

describe("AiRevenueCenterClient action boundaries", () => {
  it("navigates to approvals only after a supported proposal succeeds", async () => {
    const item = recommendation("unpaid_invoice");
    const request = deferred<unknown>();
    mocks.recommendations = ready(pageOf([item]));
    mocks.propose.mockReturnValueOnce(request.promise);
    render(<AiRevenueCenterClient />);

    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    expect(mocks.propose).toHaveBeenCalledExactlyOnceWith(item.id);
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();

    await act(async () => { request.resolve({}); });
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/command-center/approvals");
  });

  it("records Mark handled without creating a proposal or navigating", async () => {
    const item = recommendation("aging_asset");
    mocks.recommendations = ready(pageOf([item]));
    render(<AiRevenueCenterClient />);

    fireEvent.click(screen.getByRole("button", { name: "Mark handled" }));

    await waitFor(() => expect(mocks.action).toHaveBeenCalledExactlyOnceWith({
      id: item.id,
      input: { actionTaken: "marked_handled_in_revenue_center" }
    }));
    expect(mocks.propose).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows proposal failures and does not navigate", async () => {
    mocks.recommendations = ready(pageOf([recommendation("reactivation")]));
    mocks.propose.mockRejectedValueOnce(new Error("Proposal creation failed"));
    render(<AiRevenueCenterClient />);

    fireEvent.click(screen.getByRole("button", { name: "Create proposal" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Proposal creation failed");
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("preserves a record-action error until a successful retry", async () => {
    mocks.recommendations = ready(pageOf([recommendation("aging_asset")]));
    mocks.action.mockRejectedValueOnce(new Error("Could not record handling"));
    render(<AiRevenueCenterClient />);

    fireEvent.click(screen.getByRole("button", { name: "Mark handled" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not record handling");

    fireEvent.click(screen.getByRole("button", { name: "Mark handled" }));
    await waitFor(() => expect(mocks.action).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.propose).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("AiRevenueCenterClient saved-result refresh", () => {
  it("refetches both queries once and stays disabled until both finish", async () => {
    const summaryRequest = deferred<QuerySnapshot<RevenueSummary>>();
    const listRequest = deferred<QuerySnapshot<PaginatedAiRecommendations>>();
    mocks.refetchSummary.mockReturnValueOnce(summaryRequest.promise);
    mocks.refetchRecommendations.mockReturnValueOnce(listRequest.promise);
    render(<AiRevenueCenterClient />);

    fireEvent.click(refreshButton());
    fireEvent.click(refreshButton());
    expect(mocks.refetchSummary).toHaveBeenCalledTimes(1);
    expect(mocks.refetchRecommendations).toHaveBeenCalledTimes(1);
    expect(refreshButton().hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Refreshing…")).toBeTruthy();

    await act(async () => { summaryRequest.resolve(mocks.summary); });
    expect(refreshButton().hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => { listRequest.resolve(mocks.recommendations); });
    expect(refreshButton().hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("status").textContent).toContain("Saved opportunity results refreshed");
    expect(screen.getByRole("status").textContent).toContain("Automated opportunity checks run separately");
    expect(mocks.action).not.toHaveBeenCalled();
    expect(mocks.propose).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it.each(["summary", "recommendations"] as const)("reports a partial %s query failure", async (query) => {
    if (query === "summary") mocks.refetchSummary.mockResolvedValueOnce({ ...mocks.summary, isError: true });
    else mocks.refetchRecommendations.mockResolvedValueOnce({ ...mocks.recommendations, isError: true });
    render(<AiRevenueCenterClient />);

    fireEvent.click(refreshButton());

    expect((await screen.findByRole("alert")).textContent).toContain("Revenue data could not be refreshed");
    expect(screen.queryByRole("status")).toBeNull();
    expect(refreshButton().hasAttribute("disabled")).toBe(false);
    expect(mocks.refetchSummary).toHaveBeenCalledTimes(1);
    expect(mocks.refetchRecommendations).toHaveBeenCalledTimes(1);
  });

  it.each(["summary", "recommendations"] as const)("does not call a missing %s refresh result successful", async (query) => {
    if (query === "summary") mocks.refetchSummary.mockResolvedValueOnce({ data: undefined, isLoading: false, isError: false });
    else mocks.refetchRecommendations.mockResolvedValueOnce({ data: undefined, isLoading: false, isError: false });
    render(<AiRevenueCenterClient />);

    fireEvent.click(refreshButton());

    expect((await screen.findByRole("alert")).textContent).toContain("Revenue data could not be refreshed");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each(["summary", "recommendations"] as const)("keeps Refresh disabled after %s rejects while its sibling is pending", async (query) => {
    const summaryRequest = deferred<QuerySnapshot<RevenueSummary>>();
    const listRequest = deferred<QuerySnapshot<PaginatedAiRecommendations>>();
    mocks.refetchSummary.mockReturnValueOnce(summaryRequest.promise);
    mocks.refetchRecommendations.mockReturnValueOnce(listRequest.promise);
    render(<AiRevenueCenterClient />);
    fireEvent.click(refreshButton());

    await act(async () => {
      if (query === "summary") summaryRequest.reject(new Error("Connection lost"));
      else listRequest.reject(new Error("Connection lost"));
    });
    const disabledWhileSiblingPending = refreshButton().hasAttribute("disabled");

    // Always settle both promises, even when the pre-fix assertion fails.
    await act(async () => {
      if (query === "summary") listRequest.resolve(mocks.recommendations);
      else summaryRequest.resolve(mocks.summary);
    });

    expect(disabledWhileSiblingPending).toBe(true);
    expect(refreshButton().hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("alert").textContent).toContain("Revenue data could not be refreshed");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears a failed refresh notice when retry succeeds", async () => {
    mocks.refetchSummary.mockResolvedValueOnce({ ...mocks.summary, isError: true });
    render(<AiRevenueCenterClient />);
    fireEvent.click(refreshButton());
    await screen.findByRole("alert");

    fireEvent.click(refreshButton());

    expect((await screen.findByRole("status")).textContent).toContain("Saved opportunity results refreshed");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.refetchSummary).toHaveBeenCalledTimes(2);
    expect(mocks.refetchRecommendations).toHaveBeenCalledTimes(2);
  });
});

describe("AiRevenueCenterClient truthful rendered data states", () => {
  it("renders a real zero and a successful empty result with useful destinations", () => {
    render(<AiRevenueCenterClient />);

    expect(summaryRegion().getByText("$0")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No recommendations awaiting review" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Import business records" }).getAttribute("href")).toBe("/onboarding/import");
    expect(screen.getByRole("link", { name: "View customers" }).getAttribute("href")).toBe("/customers");
    expect(screen.queryByText("Recommendations could not be loaded.")).toBeNull();
  });

  it.each(["type", "customer"] as const)("distinguishes an empty %s filter from an unfiltered empty result", (filter) => {
    if (filter === "customer") searchParams.set("customerId", "customer-1");
    render(<AiRevenueCenterClient />);
    if (filter === "type") fireEvent.click(screen.getByRole("button", { name: "Estimates" }));

    expect(screen.getByRole("heading", { name: "No matching opportunities" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "No recommendations awaiting review" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Import business records" })).toBeNull();
  });

  it.each([undefined, null])("shows unavailable summary and Retry when data is %s", (data) => {
    mocks.summary = { data, isLoading: false, isError: false };
    mocks.recommendations = ready(pageOf([recommendation("aging_asset")]));
    render(<AiRevenueCenterClient />);

    expect(summaryRegion().queryByText("$0")).toBeNull();
    expect(screen.getByText("Revenue categories could not be loaded.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark handled" })).toBeTruthy();
  });

  it.each([undefined, null])("shows unavailable recommendations instead of false emptiness when data is %s", (data) => {
    mocks.recommendations = { data, isLoading: false, isError: false };
    render(<AiRevenueCenterClient />);

    expect(screen.getByText("Recommendations could not be loaded.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "No recommendations awaiting review" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "No matching opportunities" })).toBeNull();
    expect(summaryRegion().getByText("$0")).toBeTruthy();
  });

  it("hides a failed cached summary without hiding healthy recommendation actions", async () => {
    mocks.summary = { ...ready({ ...zeroSummary(), totalOpportunityValue: "750.00", fromCache: true }), isError: true };
    mocks.recommendations = ready(pageOf([recommendation("aging_asset")]));
    render(<AiRevenueCenterClient />);

    expect(summaryRegion().queryByText("$750")).toBeNull();
    expect(screen.queryByText(/Summary calculated:/)).toBeNull();
    expect(screen.getByText("Revenue categories could not be loaded.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark handled" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.refetchSummary).toHaveBeenCalledTimes(1));
    expect(mocks.refetchRecommendations).not.toHaveBeenCalled();
  });

  it("hides failed cached rows and pagination, then restores them after a successful retry", async () => {
    const cached = pageOf([recommendation("aging_asset")], 2);
    mocks.recommendations = ready(cached);
    const { rerender } = render(<AiRevenueCenterClient />);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark handled" })).toBeTruthy();

    // Hook state is modeled separately from refetch results.
    mocks.recommendations = { ...ready(cached), isError: true };
    rerender(<AiRevenueCenterClient />);
    expect(screen.getByText("Recommendations could not be loaded.")).toBeTruthy();
    expect(screen.queryByText("Revenue opportunity")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark handled" })).toBeNull();
    expect(screen.queryByText("Page 1 of 2")).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(summaryRegion().getByText("$0")).toBeTruthy();

    mocks.refetchRecommendations.mockResolvedValueOnce(ready(cached));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mocks.refetchRecommendations).toHaveBeenCalledTimes(1));
    mocks.recommendations = ready(cached);
    rerender(<AiRevenueCenterClient />);
    expect(screen.queryByText("Recommendations could not be loaded.")).toBeNull();
    expect(screen.getByRole("button", { name: "Mark handled" })).toBeTruthy();
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    expect(mocks.refetchSummary).not.toHaveBeenCalled();
  });

  it("does not show zero or empty-result claims while queries are loading", () => {
    mocks.summary = { data: undefined, isLoading: true, isError: false };
    mocks.recommendations = { data: undefined, isLoading: true, isError: false };
    render(<AiRevenueCenterClient />);

    expect(screen.getByRole("status").textContent).toContain("Loading saved figures");
    expect(summaryRegion().queryByText("$0")).toBeNull();
    expect(screen.queryByRole("heading", { name: "No recommendations awaiting review" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
