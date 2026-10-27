import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/src/lib/api", () => ({
  api: { get: (p: string) => apiGet(p) },
  ApiError: class extends Error {}
}));
vi.mock("@/src/components/csv-import/ImportReconciliationSummary", () => ({
  ImportReconciliationSummary: ({ report }: { report: { label: string } }) => <div>summary:{report.label}</div>
}));

import { ImportReconciliationReportSection } from "./ImportReconciliationReportSection";

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ImportReconciliationReportSection /></QueryClientProvider>);
}

const session = (id: string, fileName: string) => ({ id, fileName, createdAt: "2026-10-20T12:00:00.000Z", status: "completed" });

beforeEach(() => apiGet.mockReset());
afterEach(() => cleanup());

describe("ImportReconciliationReportSection", () => {
  it("shows the latest import's reconciliation and switches per import", async () => {
    apiGet.mockImplementation(async (raw: string) => {
      const path = String(raw);
      if (path.startsWith("/api/v1/imports?")) return { data: [session("a", "customers.csv"), session("b", "jobs.csv")] };
      return { report: { label: path.includes("/a/") ? "A" : "B" }, skippedRowsDownloadUrl: null };
    });
    wrap();
    expect(await screen.findByText("summary:A")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Import"), { target: { value: "b" } });
    expect(await screen.findByText("summary:B")).toBeTruthy();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/api/v1/imports/b/reconciliation"));
  });

  it("degrades when there are no imports", async () => {
    apiGet.mockResolvedValue({ data: [] });
    wrap();
    expect(await screen.findByText(/No imports yet/)).toBeTruthy();
  });
});
