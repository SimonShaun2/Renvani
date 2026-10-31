import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isPublicRoute } from "@/src/lib/route-access";
import { CUSTOMER_PORTAL_TOKEN_HEADER, clearCustomerPortalToken } from "@/src/lib/customer-portal-session";

import { CustomerPortalClient } from "./CustomerPortalClient";

type Mode = "data" | "empty" | "error" | "expired" | "loading";
let mode: Mode = "data";
const seenHeaders: string[] = [];
const seenUrls: string[] = [];

const DATA: Record<string, unknown> = {
  "/me": { account: { customer: { id: "c", firstName: "Dana", lastName: "Lee", displayName: null, email: null, phone: null }, company: { name: "Cool Air Co" } } },
  "/me/visits": { visits: { upcoming: [{ id: "v1", jobNumber: "J1", title: "AC tune-up", status: "scheduled", scheduledStart: "2026-11-02T15:00:00.000Z", scheduledEnd: null, completedAt: null }], past: [] } },
  "/me/estimates": { estimates: [{ id: "e1", estimateNumber: "E-7", title: "New furnace", status: "sent", total: "4200.00", createdAt: "2026-10-01T00:00:00.000Z", approvalToken: "apv_1" }] },
  "/me/invoices": { invoices: [{ id: "i1", invoiceNumber: "INV-9", status: "sent", total: "150.00", amountPaid: "0.00", balanceDue: "150.00", issuedAt: null, dueAt: null, paidAt: null, paymentToken: "pay_1" }] }
};
const EMPTY: Record<string, unknown> = {
  "/me": DATA["/me"],
  "/me/visits": { visits: { upcoming: [], past: [] } },
  "/me/estimates": { estimates: [] },
  "/me/invoices": { invoices: [] }
};

function renderPortal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <CustomerPortalClient />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mode = "data";
  seenHeaders.length = 0;
  seenUrls.length = 0;
  window.sessionStorage.clear();
  clearCustomerPortalToken();
  window.history.replaceState(null, "", "/portal#token=jwt.portal.token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      seenUrls.push(url);
      seenHeaders.push(new Headers(init.headers).get(CUSTOMER_PORTAL_TOKEN_HEADER) ?? "");
      const path = url.replace(/^.*\/api\/v1\/public\/customer-portal/, "");
      if (mode === "loading") return new Promise(() => undefined);
      if (mode === "expired") return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "expired" }), { status: 401 });
      if (mode === "error" && path !== "/me") return new Response(JSON.stringify({ error: "INTERNAL", message: "x" }), { status: 500 });
      return new Response(JSON.stringify((mode === "empty" ? EMPTY : DATA)[path]), { status: 200 });
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CustomerPortalClient", () => {
  it("is a public route and strips the token from the URL, sending it only as a header", async () => {
    expect(isPublicRoute("/portal")).toBe(true);
    renderPortal();
    expect(await screen.findByText("Hi, Dana Lee")).toBeTruthy();
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain("jwt.portal.token");
    expect(seenUrls.every((u) => !u.includes("jwt.portal.token"))).toBe(true);
    expect(seenHeaders.every((h) => h === "jwt.portal.token")).toBe(true);
    expect(window.sessionStorage.getItem("renvani.customer-portal.token")).toBe("jwt.portal.token");
  });

  it("renders data with pay and estimate links and no fee copy", async () => {
    renderPortal();
    expect(await screen.findByText("AC tune-up")).toBeTruthy();
    expect((await screen.findByRole("link", { name: "Pay" })).getAttribute("href")).toBe("/pay/pay_1");
    expect(screen.getByRole("link", { name: "View" }).getAttribute("href")).toBe("/approve/apv_1");
    expect(document.body.textContent).not.toMatch(/fee|5%/i);
  });

  it("renders loading states", async () => {
    mode = "loading";
    renderPortal();
    expect(await screen.findByText("Loading visits…")).toBeTruthy();
    expect(screen.getByText("Loading invoices…")).toBeTruthy();
  });

  it("renders empty states", async () => {
    mode = "empty";
    renderPortal();
    expect(await screen.findByText("No visits yet.")).toBeTruthy();
    expect(screen.getByText("No estimates yet.")).toBeTruthy();
    expect(await screen.findByText("No invoices yet.")).toBeTruthy();
  });

  it("renders error with Retry that refetches", async () => {
    mode = "error";
    renderPortal();
    expect(await screen.findByText("Invoices could not be loaded.", {}, { timeout: 5000 })).toBeTruthy();
    mode = "data";
    const retries = screen.getAllByRole("button", { name: "Retry" });
    expect(retries.length).toBe(3);
    retries.forEach((b) => fireEvent.click(b));
    expect(await screen.findByText("Invoice INV-9 · $150.00 due")).toBeTruthy();
  });

  it("shows link expired on 401 and clears the stored token", async () => {
    mode = "expired";
    renderPortal();
    expect(await screen.findByText("This link has expired")).toBeTruthy();
    await waitFor(() => expect(window.sessionStorage.getItem("renvani.customer-portal.token")).toBeNull());
  });

  it("shows link expired when no token is present", async () => {
    window.history.replaceState(null, "", "/portal");
    renderPortal();
    expect(await screen.findByText("This link has expired")).toBeTruthy();
  });
});

describe("customer portal credential changes (Bugbot #222)", () => {
  it("does not reuse cached data across tokens, even with a long staleTime", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
    const first = render(
      <QueryClientProvider client={client}>
        <CustomerPortalClient />
      </QueryClientProvider>
    );
    await screen.findByText("AC tune-up");
    first.unmount();
    seenHeaders.length = 0;
    window.history.replaceState(null, "", "/portal#token=other.customer.token");
    render(
      <QueryClientProvider client={client}>
        <CustomerPortalClient />
      </QueryClientProvider>
    );
    await waitFor(() => expect(seenHeaders.filter((h) => h === "other.customer.token")).toHaveLength(4));
  });

  it("captures a magic link pasted into an open tab (fragment navigation)", async () => {
    window.history.replaceState(null, "", "/portal");
    renderPortal();
    expect(await screen.findByText(/expired/i)).toBeTruthy();
    window.history.replaceState(null, "", "/portal#token=pasted.token");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await screen.findByText("AC tune-up");
    expect(seenHeaders).toContain("pasted.token");
    expect(window.location.hash).toBe("");
  });

  it("switches to a replacement link while viewing the portal", async () => {
    renderPortal();
    await screen.findByText("AC tune-up");
    seenHeaders.length = 0;
    window.history.replaceState(null, "", "/portal#token=replacement.token");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => expect(seenHeaders.filter((h) => h === "replacement.token").length).toBeGreaterThanOrEqual(4));
    expect(seenHeaders).not.toContain("jwt.portal.token");
    expect(window.location.hash).toBe("");
  });
});
