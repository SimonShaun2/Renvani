import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
let role: string | null = "owner";
vi.mock("@/src/lib/api", () => ({
  api: { get: (p: string) => apiGet(p), post: (p: string, b: unknown) => apiPost(p, b) },
  ApiError: class extends Error {}
}));
vi.mock("@/src/lib/auth", () => ({ getStoredSession: () => null }));
vi.mock("@/src/stores/auth.store", () => ({
  useAuthStore: (sel: (s: { user: { role: string | null } }) => unknown) => sel({ user: { role } })
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PaymentsClient } from "./PaymentsClient";
import { buildPaymentsQuery, paymentStatusTone, serviceFeeLabel } from "./payments.utils";

const payment = {
  id: "p1", invoiceId: "inv-1", customerId: "c1", amount: "240.00", method: "card", status: "succeeded",
  checkNumber: null, referenceNumber: null, paidAt: "2026-10-22T15:00:00.000Z", createdAt: "2026-10-22T15:00:00.000Z"
};

function page(data: unknown[], total = data.length) {
  return { data, total, page: 1, limit: 25, totalPages: Math.max(1, Math.ceil(total / 25)) };
}

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PaymentsClient /></QueryClientProvider>);
}

beforeEach(() => {
  role = "owner";
  apiGet.mockReset();
  apiPost.mockReset();
  apiGet.mockImplementation(async (path: string) => {
    if (path.includes("stripe/connect/status")) {
      return { connected: true, accountName: "Sparkle & Co", payoutSchedule: "weekly", platformFeePercent: 2, lastPayoutAmount: "4218.40", lastPayoutAt: "2026-10-23T00:00:00.000Z" };
    }
    if (path.includes("status=disputed")) return page([{ ...payment, id: "d1", status: "disputed" }]);
    if (path.includes("status=pending")) return page([], 3);
    if (path.includes("status=succeeded")) return page([payment], 12);
    return page([payment]);
  });
});
afterEach(() => cleanup());

describe("payments utils", () => {
  it("builds the /payments query from filters", () => {
    const q = new URLSearchParams(buildPaymentsQuery({ status: "refunded", method: "all", from: "2026-10-01", page: 2 }));
    expect(q.get("status")).toBe("refunded");
    expect(q.has("method")).toBe(false);
    expect(new Date(q.get("createdAfter")!).getDate()).toBe(1);
    expect(q.get("page")).toBe("2");
    expect(q.get("sortOrder")).toBe("desc");
  });

  it("labels the Service Fee from the API percent only", () => {
    expect(serviceFeeLabel(2)).toBe("Service Fee 2% · paid by customer at checkout");
    expect(serviceFeeLabel(0)).toBeNull();
    expect(serviceFeeLabel(undefined)).toBeNull();
    expect(paymentStatusTone("disputed")).toBe("red");
  });
});

describe("PaymentsClient", () => {
  it("shows overview totals, payout and recent transactions from the API", async () => {
    wrap();
    expect(await screen.findByText("12")).toBeTruthy();
    expect(await screen.findByText("3")).toBeTruthy();
    expect(await screen.findByText("$4,218.40")).toBeTruthy();
    expect(screen.getByText(/Service Fee 2%/)).toBeTruthy();
    expect((await screen.findAllByRole("link", { name: "View invoice" }))[0]?.getAttribute("href")).toBe("/invoices/inv-1");
  });

  it("filters transactions by status", async () => {
    wrap();
    fireEvent.click(screen.getByRole("button", { name: "Transactions" }));
    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "refunded" } });
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(expect.stringMatching(/status=refunded.*page=1&limit=25/)));
  });

  it("opens payouts in the Stripe dashboard via the dashboard-link route", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    apiPost.mockResolvedValue({ url: "https://connect.stripe.test/express" });
    wrap();
    fireEvent.click(screen.getByRole("button", { name: "Payouts" }));
    fireEvent.click(screen.getByRole("button", { name: "View payouts in Stripe" }));
    await waitFor(() => expect(tab.location.href).toBe("https://connect.stripe.test/express"));
    expect(apiPost).toHaveBeenCalledWith("/api/v1/stripe/connect/dashboard-link", {});
  });

  it("is limited to owners and admins", () => {
    role = "dispatcher";
    wrap();
    expect(screen.getByText("Owners and admins only")).toBeTruthy();
    expect(apiGet).not.toHaveBeenCalledWith(expect.stringContaining("/api/v1/payments"));
    expect(apiGet).not.toHaveBeenCalledWith(expect.stringContaining("/api/v1/stripe/connect/status"));
  });

  it("hides Stripe dashboard buttons from admins (owner-only route)", async () => {
    role = "admin";
    wrap();
    fireEvent.click(screen.getByRole("button", { name: "Payouts" }));
    expect(await screen.findByText(/Only the account owner can open the Stripe dashboard/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "View payouts in Stripe" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Disputes" }));
    expect(screen.queryByRole("button", { name: "Respond in Stripe" })).toBeNull();
  });
});
