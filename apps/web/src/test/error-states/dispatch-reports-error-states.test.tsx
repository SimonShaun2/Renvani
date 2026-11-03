import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ fail: true, calls: 0 }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/"
}));
vi.mock("@/src/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/src/lib/api")>();
  const get = (path: string) => {
    m.calls += 1;
    if (m.fail) return Promise.reject(new Error("Mock server error"));
    if (path.startsWith("/api/v1/reporting/job-sources")) {
      return Promise.resolve({
        period: { startDate: "2026-10-01", endDate: "2026-10-31", timeZone: "America/Chicago", dateInterpretation: "job_created_at" },
        totals: { bookedJobCount: 0, revenue: "0.00", unknownAttributionCount: 0, unknownAttributionDefinition: "x" },
        channels: []
      });
    }
    return Promise.resolve({ data: [], total: 0, page: 1, limit: 100, totalPages: 1 });
  };
  return { ...actual, api: { get, post: get, patch: get, put: get, delete: get } };
});

import { DispatchQueuePanel, type QueueLoadError } from "@/src/components/dispatch/DispatchQueuePanel";
import { ReportingDashboardClient, reportCsvFileName } from "@/src/components/reporting/ReportingDashboardClient";

afterEach(() => {
  cleanup();
  m.fail = true;
  m.calls = 0;
});

function renderPanel(error: QueueLoadError | null) {
  return render(
    <DndContext>
      <DispatchQueuePanel
        activeTab="schedule"
        selectedJobId={null}
        selectedBookingRequestId={null}
        dispatchView={{ date: "2026-10-27", technicians: [], nextBestJobs: [] }}
        isLoading={false}
        bookingRequests={[]}
        bookingRequestsLoading={false}
        unscheduledJobs={[]}
        unscheduledLoading={false}
        approvedEstimates={[]}
        approvedEstimatesLoading={false}
        search=""
        onSelectTab={vi.fn()}
        onSelectJob={vi.fn()}
        onSelectBookingRequest={vi.fn()}
        onAutoFitJob={vi.fn()}
        onConvertEstimate={vi.fn()}
        autoFittingJobId={null}
        convertingEstimateId={null}
        smartQueueError={error}
        approvedEstimatesError={error}
      />
    </DndContext>
  );
}

describe("dispatch queue error state (bug 2)", () => {
  it("shows an error with Retry instead of 'No smart queue items' on failure", () => {
    const onRetry = vi.fn();
    renderPanel({ onRetry, isRetrying: false });
    expect(screen.getByText("Smart queue could not be loaded")).toBeTruthy();
    expect(screen.getByText("Approved estimates could not be loaded")).toBeTruthy();
    expect(screen.queryByText("No smart queue items")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]!);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps the empty state when there is no error", () => {
    renderPanel(null);
    expect(screen.getByText("No smart queue items")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});

function renderReports() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ReportingDashboardClient />
    </QueryClientProvider>
  );
}

describe("reports dashboard error states (bug 3)", () => {
  it("shows errors with Retry instead of chart empty states, and Retry refetches", async () => {
    renderReports();
    expect(await screen.findByText("Revenue could not be loaded")).toBeTruthy();
    expect(screen.getByText("Technician utilization could not be loaded")).toBeTruthy();
    expect(screen.getByText("Pipeline could not be loaded")).toBeTruthy();
    expect(screen.queryByText("No revenue in this range")).toBeNull();
    expect(screen.queryByText("No active technicians")).toBeNull();
    const before = m.calls;
    m.fail = false;
    screen.getAllByRole("button", { name: "Retry" }).forEach((b) => fireEvent.click(b));
    await waitFor(() => expect(screen.queryByText("Revenue could not be loaded")).toBeNull());
    expect(m.calls).toBeGreaterThan(before);
  });

  it("shows empty states and no Retry when the API returns no data", async () => {
    m.fail = false;
    renderReports();
    expect(await screen.findByText("No active technicians")).toBeTruthy();
    expect(screen.queryByText(/could not be loaded/)).toBeNull();
  });
});

describe("report CSV download name", () => {
  it("uses the Renvani name", () => {
    expect(reportCsvFileName("Last 30 days")).toBe("renvani-report-last-30-days.csv");
    expect(reportCsvFileName("")).toBe("renvani-report-export.csv");
  });
});
