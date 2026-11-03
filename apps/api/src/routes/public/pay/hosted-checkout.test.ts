import type Stripe from "stripe";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetFixedWindowRateLimitStateForTests } from "../../../lib/fixed-window-rate-limit.js";
import { HOSTED_CHECKOUT_IP_LIMIT, HOSTED_CHECKOUT_TOKEN_LIMIT } from "../../../lib/public-hosted-checkout-rate-limit.js";
import { setupTestEnv } from "../../../test-support/env-setup.js";

setupTestEnv();

const { createMock, expireMock, retrieveMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  expireMock: vi.fn(),
  retrieveMock: vi.fn()
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() }
}));

vi.mock("../../../lib/stripe.js", () => ({
  createInvoiceCheckoutSession: createMock,
  expireInvoiceCheckoutSession: expireMock,
  retrieveInvoiceCheckoutSession: retrieveMock,
  retrieveInvoiceCheckoutClientSecret: vi.fn().mockResolvedValue(null)
}));

type AppInstance = Awaited<ReturnType<typeof import("../../../app.js")["buildApp"]>>;
let buildApp: typeof import("../../../app.js")["buildApp"];
let fakeDb: typeof import("../../../test-support/fake-db.js");
let invoiceService: typeof import("../../../services/invoice.service.js");
let app: AppInstance;

beforeAll(async () => {
  ({ buildApp } = await import("../../../app.js"));
  fakeDb = await import("../../../test-support/fake-db.js");
  invoiceService = await import("../../../services/invoice.service.js");
});

const TOKEN = "h".repeat(40);
const OTHER_TOKEN = "o".repeat(40);
const sessions = new Map<string, { id: string; uiMode: string; status: string; url: string | null; expiresAt: Date; invoiceId: string; companyId: string }>();

beforeEach(async () => {
  resetFixedWindowRateLimitStateForTests();
  fakeDb.resetTestState();
  sessions.clear();
  createMock.mockReset();
  expireMock.mockReset();
  retrieveMock.mockReset();
  let n = 0;
  createMock.mockImplementation(async (input: { invoiceId: string; companyId: string }) => {
    n += 1;
    const id = `cs_hosted_${n}`;
    sessions.set(id, { id, uiMode: "hosted", status: "open", url: `https://checkout.stripe.test/${id}`, expiresAt: new Date("2026-10-29T12:00:00Z"), invoiceId: input.invoiceId, companyId: input.companyId });
    return { id, url: `https://checkout.stripe.test/${id}`, clientSecret: null };
  });
  retrieveMock.mockImplementation(async (id: string) => {
    const s = sessions.get(id);
    if (!s) throw new Error("No such session");
    return { ...s, paymentStatus: s.status === "complete" ? "paid" : "unpaid" };
  });
  expireMock.mockImplementation(async (id: string) => {
    const s = sessions.get(id);
    if (s) s.status = "expired";
  });
  app = await buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function seed(opts: { plan?: "flex" | "flat"; status?: string; balanceDue?: string; amountPaid?: string } = {}) {
  const company = fakeDb.seedCompany({
    name: "Summit Heating",
    slug: "summit",
    timezone: "America/Chicago",
    stripeAccountId: "acct_tenant_a",
    settings: { stripePlatformBilling: { planTier: opts.plan ?? "flex" } }
  } as Parameters<typeof fakeDb.seedCompany>[0]);
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Dana", lastName: "Ruiz", email: "dana@example.com" });
  const invoice = fakeDb.seedInvoice({
    companyId: company.id,
    customerId: customer.id,
    invoiceNumber: "INV-2001",
    status: opts.status ?? "sent",
    total: "100.00",
    amountPaid: opts.amountPaid ?? "0.00",
    balanceDue: opts.balanceDue ?? "100.00",
    paymentToken: TOKEN,
    stripePaymentLinkId: "cs_embedded_1",
    stripePaymentLinkUrl: `https://app.test/pay/${TOKEN}`
  } as Parameters<typeof fakeDb.seedInvoice>[0]);
  fakeDb.seedInvoiceItem({ companyId: company.id, invoiceId: invoice.id, name: "Tune-up", quantity: "1.000", unitPrice: "100.00", total: "100.00" } as Parameters<typeof fakeDb.seedInvoiceItem>[0]);
  sessions.set("cs_embedded_1", { id: "cs_embedded_1", uiMode: "embedded", status: "open", url: null, expiresAt: new Date("2026-10-29T12:00:00Z"), invoiceId: invoice.id, companyId: company.id });
  return { company, customer, invoice };
}

function post(token = TOKEN) {
  return app.inject({ method: "POST", url: `/api/v1/public/pay/${token}/hosted-checkout` });
}

describe("POST /api/v1/public/pay/:token/hosted-checkout", () => {
  it("creates a hosted session, expires the open embedded one, stores the new id, returns only the allowlist", async () => {
    const { company, invoice } = seed();
    const res = await post();
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      mode: "hosted",
      checkoutUrl: "https://checkout.stripe.test/cs_hosted_1",
      expiresAt: "2026-10-29T12:00:00.000Z",
      reused: false
    });
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).not.toMatch(/acct_|cs_embedded|dana@|clientSecret|client_secret/);
    expect(expireMock).toHaveBeenCalledWith("cs_embedded_1");
    const input = createMock.mock.calls[0]![0];
    expect(input).toMatchObject({
      forceHosted: true,
      companyId: company.id,
      invoiceId: invoice.id,
      companyStripeAccountId: "acct_tenant_a",
      total: "100.00",
      renvaniPlan: "flex",
      paymentToken: TOKEN,
      items: [{ name: "Tune-up", total: "100.00" }]
    });
    expect(input.idempotencyKey).toMatch(new RegExp(`^invoice-hosted-checkout:${invoice.id}:cs_embedded_1:100.00:`));
    expect(fakeDb.getTestState().invoices.find((r) => r.id === invoice.id)?.stripePaymentLinkId).toBe("cs_hosted_1");
  });

  it("Flat tenant passes renvaniPlan flat (no Service Fee in the shared session builder)", async () => {
    seed({ plan: "flat" });
    expect((await post()).statusCode).toBe(200);
    expect(createMock.mock.calls[0]![0]).toMatchObject({ renvaniPlan: "flat" });
  });

  it("idempotent: a repeat request reuses the open hosted session (one session per invoice)", async () => {
    seed();
    const first = (await post()).json();
    const second = await post();
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ ...first, reused: true });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("partially paid: charges only the balance as a single line", async () => {
    seed({ status: "partially_paid", amountPaid: "40.00", balanceDue: "60.00" });
    expect((await post()).statusCode).toBe(200);
    expect(createMock.mock.calls[0]![0]).toMatchObject({
      total: "60.00",
      items: [{ name: "Invoice INV-2001 balance", quantity: "1", total: "60.00" }]
    });
  });

  it.each([
    ["paid", "0.00", "Invoice is already paid"],
    ["void", "100.00", "Invoice is not payable"],
    ["draft", "100.00", "Invoice is not payable"],
    ["sent", "0.00", "Invoice is already paid"]
  ])("refuses %s (balance %s) with 409 and creates nothing", async (status, balanceDue, message) => {
    seed({ status, balanceDue });
    const res = await post();
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toBe(message);
    expect(createMock).not.toHaveBeenCalled();
    expect(expireMock).not.toHaveBeenCalled();
  });

  it("stored session retrieve fails (transient) → retryable 409, no new session, no DB change", async () => {
    const { invoice } = seed();
    const row = () => fakeDb.getTestState().invoices.find((r) => r.id === invoice.id);
    const before = JSON.stringify(row());
    retrieveMock.mockRejectedValue(Object.assign(new Error("Stripe API connection error"), { type: "StripeConnectionError" }));
    const res = await post();
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/retry/i);
    expect(createMock).not.toHaveBeenCalled();
    expect(expireMock).not.toHaveBeenCalled();
    expect(JSON.stringify(row())).toBe(before);
  });

  it("stored session definitively missing (resource_missing) → replaced by exactly one new session", async () => {
    const { invoice } = seed();
    sessions.delete("cs_embedded_1");
    const base = retrieveMock.getMockImplementation()!;
    retrieveMock.mockImplementation(async (id: string) => {
      if (id === "cs_embedded_1") throw Object.assign(new Error("No such checkout.session"), { code: "resource_missing" });
      return base(id);
    });
    const res = await post();
    expect(res.statusCode).toBe(200);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(fakeDb.getTestState().invoices.find((r) => r.id === invoice.id)?.stripePaymentLinkId).toBe("cs_hosted_1");
  });

  it("refuses when the stored session already completed (payment in flight) — no second payable session", async () => {
    seed();
    sessions.get("cs_embedded_1")!.status = "complete";
    const res = await post();
    expect(res.statusCode).toBe(409);
    expect(createMock).not.toHaveBeenCalled();
  });

  it(`rate limits per token (${HOSTED_CHECKOUT_TOKEN_LIMIT}/10 min) across IPs with 429 + Retry-After, no Stripe call`, async () => {
    for (let i = 0; i < HOSTED_CHECKOUT_TOKEN_LIMIT; i += 1) {
      const ok = await app.inject({ method: "POST", url: `/api/v1/public/pay/${TOKEN}/hosted-checkout`, remoteAddress: `198.51.100.${i + 1}` });
      expect(ok.statusCode).not.toBe(429);
    }
    const callsBefore = createMock.mock.calls.length;
    const res = await app.inject({ method: "POST", url: `/api/v1/public/pay/${TOKEN}/hosted-checkout`, remoteAddress: "198.51.100.200" });
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    expect(Object.keys(res.json()).sort()).toEqual(["error", "message", "requestId"]);
    expect(res.json().error).toBe("RATE_LIMITED");
    expect(createMock.mock.calls.length).toBe(callsBefore);
  });

  it(`rate limits per IP (${HOSTED_CHECKOUT_IP_LIMIT}/10 min) across tokens`, async () => {
    for (let i = 0; i < HOSTED_CHECKOUT_IP_LIMIT; i += 1) {
      const res = await app.inject({ method: "POST", url: `/api/v1/public/pay/unknown-token-${String(i).padStart(30, "x")}/hosted-checkout`, remoteAddress: "203.0.113.7" });
      expect(res.statusCode).not.toBe(429);
    }
    const res = await app.inject({ method: "POST", url: `/api/v1/public/pay/${TOKEN}/hosted-checkout`, remoteAddress: "203.0.113.7" });
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("unknown token → 404; short token → 400", async () => {
    seed();
    expect((await post(OTHER_TOKEN)).statusCode).toBe(404);
    expect((await post("short")).statusCode).toBe(400);
  });

  it("tenant scoping: a stored session whose metadata belongs to another tenant/invoice is neither reused nor expired", async () => {
    const { invoice } = seed();
    sessions.set("cs_foreign", { id: "cs_foreign", uiMode: "hosted", status: "open", url: "https://checkout.stripe.test/cs_foreign", expiresAt: new Date(), invoiceId: "other-invoice", companyId: "other-company" });
    const row = fakeDb.getTestState().invoices.find((r) => r.id === invoice.id)!;
    row.stripePaymentLinkId = "cs_foreign";
    const res = await post();
    expect(res.statusCode).toBe(200);
    expect(res.json().checkoutUrl).toBe("https://checkout.stripe.test/cs_hosted_1");
    expect(expireMock).not.toHaveBeenCalledWith("cs_foreign");
  });

  it("tenant scoping: customer from another company is never used", async () => {
    const { invoice } = seed();
    const other = fakeDb.seedCompany({ name: "Other", slug: "other", timezone: "America/Chicago" });
    const foreign = fakeDb.seedCustomer({ companyId: other.id, firstName: "X", lastName: "Y", email: "x@other.example" });
    fakeDb.getTestState().invoices.find((r) => r.id === invoice.id)!.customerId = foreign.id;
    const res = await post();
    expect(res.statusCode).toBe(404);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("no double record: hosted payment records once via PaymentIntent id, then further hosted requests refuse", async () => {
    const { company, customer, invoice } = seed();
    expect((await post()).statusCode).toBe(200);
    const event = {
      data: {
        object: {
          id: "pi_hosted_1",
          amount: 10_200,
          amount_received: 10_200,
          latest_charge: "ch_hosted_1",
          payment_method_types: ["card"],
          metadata: { companyId: company.id, invoiceId: invoice.id, customerId: customer.id, invoiceAmountCents: "10000", serviceFeeCents: "200" }
        }
      }
    } as unknown as Stripe.PaymentIntentSucceededEvent;
    await invoiceService.handleStripePaymentSuccess(event);
    await invoiceService.handleStripePaymentSuccess(event);
    expect(fakeDb.getTestState().payments.filter((p) => p.invoiceId === invoice.id)).toHaveLength(1);
    expect((await post()).statusCode).toBe(409);
  });
});
