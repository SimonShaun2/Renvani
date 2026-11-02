// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/src/lib/public-api", () => ({ publicApi: { post: m.post, get: vi.fn() } }));

import { ApiError } from "@/src/lib/api";

import { PayHostedCheckoutButton } from "./PayHostedCheckoutButton";
import { classifyHostedCheckoutError } from "./pay-hosted-checkout";
import { resolvePayNotice } from "./pay-invoice.utils";

const conflict = (message: string) => new ApiError(409, { error: "CONFLICT" as never, message, requestId: "r1" } as never);

// Pre-handled rejection so the spy's own result tracking can't surface it as unhandled.
function rejected(error: unknown) {
  const promise = Promise.reject(error);
  promise.catch(() => undefined);
  return promise;
}

function renderButton(redirect = vi.fn()) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={client}>
      <PayHostedCheckoutButton token="tok_1" redirect={redirect} />
    </QueryClientProvider>
  );
  return { redirect, invalidate };
}
const payNow = () => screen.getByRole("button", { name: /Pay now|Opening/ }) as HTMLButtonElement;

beforeEach(() => m.post.mockReset());
afterEach(() => cleanup());

describe("classifyHostedCheckoutError", () => {
  it("maps 400/404/409/429/network per the #292 contract", () => {
    expect(classifyHostedCheckoutError(new ApiError(400, { error: "VALIDATION_ERROR" as never, message: "bad" })).kind).toBe("invalid");
    expect(classifyHostedCheckoutError(new ApiError(404, { error: "NOT_FOUND" as never, message: "Invoice not found" })).kind).toBe("invalid");
    expect(classifyHostedCheckoutError(conflict("Invoice is already paid"))).toMatchObject({ kind: "paid", canRetry: false, refresh: true });
    expect(classifyHostedCheckoutError(conflict("A payment for this invoice is already processing")).kind).toBe("processing");
    expect(classifyHostedCheckoutError(conflict("Invoice is not payable")).kind).toBe("unpayable");
    expect(classifyHostedCheckoutError(conflict("Invoice payment link is unavailable")).kind).toBe("unpayable");
    expect(classifyHostedCheckoutError(conflict("Checkout changed while preparing; please retry"))).toMatchObject({ kind: "retry", canRetry: true });
    expect(classifyHostedCheckoutError(conflict("Payment page is temporarily unavailable; please retry in a moment")).kind).toBe("retry");
    expect(classifyHostedCheckoutError(new ApiError(429, { error: "RATE_LIMITED" as never, message: "Too many" })).kind).toBe("rate_limited");
    expect(classifyHostedCheckoutError(new TypeError("fetch failed"))).toMatchObject({ kind: "temporary", canRetry: true });
  });
});

describe("PayHostedCheckoutButton", () => {
  it("POSTs with no body and redirects to checkoutUrl", async () => {
    m.post.mockResolvedValue({ mode: "hosted", checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_1", expiresAt: null, reused: false });
    const { redirect } = renderButton();
    await act(async () => fireEvent.click(payNow()));
    expect(m.post).toHaveBeenCalledWith("/api/v1/public/pay/tok_1/hosted-checkout", undefined);
    expect(redirect).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_1");
  });

  it("409 already paid: shows message, disables Pay now, refreshes the pay view", async () => {
    m.post.mockImplementationOnce(() => rejected(conflict("Invoice is already paid")));
    const { redirect, invalidate } = renderButton();
    await act(async () => fireEvent.click(payNow()));
    expect(screen.getByRole("alert").textContent).toBe("This invoice is already paid.");
    expect(payNow().disabled).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["invoices", "public-pay", "tok_1"] });
    expect(redirect).not.toHaveBeenCalled();
    expect(m.post).toHaveBeenCalledTimes(1);
  });

  it("409 checkout changed: retry stays enabled and a second click succeeds", async () => {
    m.post.mockRejectedValueOnce(conflict("Checkout changed while preparing; please retry")).mockResolvedValueOnce({ mode: "hosted", checkoutUrl: "https://x/cs", expiresAt: null, reused: true });
    const { redirect } = renderButton();
    await act(async () => fireEvent.click(payNow()));
    expect(screen.getByRole("alert").getAttribute("data-error-kind")).toBe("retry");
    expect(payNow().disabled).toBe(false);
    await act(async () => fireEvent.click(payNow()));
    expect(redirect).toHaveBeenCalledWith("https://x/cs");
  });

  it("?status=cancelled yields the neutral canceled notice", () => {
    expect(resolvePayNotice("cancelled")).toMatchObject({ tone: "neutral", title: "Payment canceled" });
  });
});
