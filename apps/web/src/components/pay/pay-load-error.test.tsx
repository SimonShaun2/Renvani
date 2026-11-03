import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/src/lib/api";

import { classifyPayLoadError } from "./pay-invoice.utils";

const query = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("next/navigation", () => ({ useParams: () => ({ token: "tok" }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/src/hooks/invoices.hooks", () => ({ usePublicPaymentLink: () => query.value }));
vi.mock("@/src/components/stripe/StripeEmbeddedInvoiceCheckout", () => ({
  isEmbeddedCheckoutAvailable: () => false,
  StripeEmbeddedInvoiceCheckout: () => null
}));

import PublicPaymentPage from "@/app/(public)/pay/[token]/page";

const err = (status: number) => new ApiError(status, { error: "X", message: "x" } as never);

describe("classifyPayLoadError", () => {
  it("maps 5xx/429/network to temporary, 400 to invalid, 404/410 to unavailable", () => {
    expect(classifyPayLoadError(err(500))).toBe("temporary");
    expect(classifyPayLoadError(err(503))).toBe("temporary");
    expect(classifyPayLoadError(err(429))).toBe("temporary");
    expect(classifyPayLoadError(new TypeError("Failed to fetch"))).toBe("temporary");
    expect(classifyPayLoadError(err(400))).toBe("invalid");
    expect(classifyPayLoadError(err(404))).toBe("unavailable");
    expect(classifyPayLoadError(err(410))).toBe("unavailable");
  });
});

describe("/pay/[token] load errors", () => {
  afterEach(() => cleanup());

  it("shows a temporary error with Try again on 5xx", () => {
    const refetch = vi.fn();
    query.value = { isError: true, error: err(500), refetch, isFetching: false };
    render(<PublicPaymentPage />);
    expect(screen.getByTestId("pay-error-temporary").textContent).toContain("usually temporary");
    expect(screen.queryByText(/may have expired/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("keeps the expired copy for 404 without a retry button", () => {
    query.value = { isError: true, error: err(404), refetch: vi.fn(), isFetching: false };
    render(<PublicPaymentPage />);
    expect(screen.getByText(/may have expired/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
