import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
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
    if (path.startsWith("/api/v1/estimates") || path.startsWith("/api/v1/invoices")) m.calls += 1;
    return m.fail
      ? Promise.reject(new Error("Mock server error"))
      : Promise.resolve({ data: [], total: 0, page: 1, limit: 25, totalPages: 1 });
  };
  return { ...actual, api: { get, post: get, patch: get, put: get, delete: get } };
});

import { EstimateListClient } from "@/src/components/estimates/EstimateListClient";
import { InvoiceListClient } from "@/src/components/invoices/InvoiceListClient";

function renderWithClient(Comp: ComponentType) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <Comp />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  m.fail = true;
  m.calls = 0;
});

describe.each([
  { name: "estimates", Comp: EstimateListClient, error: /Estimates could not be loaded/, empty: /No estimates match this view/ },
  { name: "invoices", Comp: InvoiceListClient, error: /Invoices could not be loaded/, empty: /No invoices match this view/ }
])("$name list error state", ({ Comp, error, empty }) => {
  it("shows an error with Retry, not the empty state, on API failure", async () => {
    renderWithClient(Comp);
    expect(await screen.findByText(error)).toBeTruthy();
    expect(screen.queryByText(empty)).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("Retry refetches and shows the empty state once the API recovers", async () => {
    renderWithClient(Comp);
    await screen.findByText(error);
    const before = m.calls;
    m.fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByText(empty)).toBeTruthy());
    expect(m.calls).toBeGreaterThan(before);
    expect(screen.queryByText(error)).toBeNull();
  });

  it("shows the empty state (no error) when the API returns no rows", async () => {
    m.fail = false;
    renderWithClient(Comp);
    expect(await screen.findByText(empty)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
