import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const { createSessionMock } = vi.hoisted(() => ({ createSessionMock: vi.fn() }));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: createSessionMock, retrieve: vi.fn() } }
  }))
}));

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: { stripeRenvaniEmbeddedCheckout: false }
}));

type StripeLib = typeof import("./stripe.js");
let createInvoiceCheckoutSession: StripeLib["createInvoiceCheckoutSession"];
let SERVICE_FEE_LINE_ITEM_NAME: string;

beforeAll(async () => {
  const lib = await import("./stripe.js");
  createInvoiceCheckoutSession = lib.createInvoiceCheckoutSession;
  SERVICE_FEE_LINE_ITEM_NAME = lib.SERVICE_FEE_LINE_ITEM_NAME;
});

type LineItem = { price_data: { unit_amount: number; product_data: { name: string } } };

function baseInput(overrides: Partial<Parameters<StripeLib["createInvoiceCheckoutSession"]>[0]> = {}): Parameters<StripeLib["createInvoiceCheckoutSession"]>[0] {
  return {
    companyId: "co_1",
    invoiceId: "inv_1",
    customerId: "cus_1",
    customerEmail: "c@example.com",
    companyStripeAccountId: "acct_1",
    companyName: "Acme HVAC",
    invoiceNumber: "INV-0001",
    total: "123.25",
    items: [{ name: "Repair", description: null, quantity: "1", total: "123.25" }],
    paymentToken: "tok_1",
    renvaniPlan: null,
    ...overrides
  };
}

function lastCall() {
  const params = createSessionMock.mock.calls.at(-1)?.[0] as {
    line_items: LineItem[];
    payment_intent_data: { application_fee_amount?: number; metadata: Record<string, string> };
  };
  return params;
}

describe("createInvoiceCheckoutSession fee lines", () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    createSessionMock.mockResolvedValue({ id: "cs_1", url: "https://checkout.test/cs_1", client_secret: null });
  });

  it("Service Fee label is derived from SERVICE_FEE_RATE_BPS", () => {
    expect(SERVICE_FEE_LINE_ITEM_NAME).toBe("Service Fee (2%)");
  });

  it("Flex: invoice line + 2% Service Fee line only; no booking fee line or metadata", async () => {
    await createInvoiceCheckoutSession(baseInput({ renvaniPlan: "flex" }));
    const p = lastCall();
    expect(p.line_items.map((l) => l.price_data.product_data.name)).toEqual(["Repair", "Service Fee (2%)"]);
    expect(p.line_items[1]!.price_data.unit_amount).toBe(247);
    expect(p.payment_intent_data.application_fee_amount).toBe(247);
    expect(p.payment_intent_data.metadata).toMatchObject({ serviceFeeCents: "247" });
    expect(p.payment_intent_data.metadata).not.toHaveProperty("bookingFeeCents");
  });

  it("Flat: invoice line only, no fee lines and no application fee", async () => {
    await createInvoiceCheckoutSession(baseInput({ renvaniPlan: "flat" }));
    const p = lastCall();
    expect(p.line_items).toHaveLength(1);
    expect(p.payment_intent_data.application_fee_amount).toBeUndefined();
    expect(p.payment_intent_data.metadata).toMatchObject({ serviceFeeCents: "0" });
    expect(p.payment_intent_data.metadata).not.toHaveProperty("bookingFeeCents");
  });

  it("unknown/null plan defaults to the standard Service Fee", async () => {
    await createInvoiceCheckoutSession(baseInput({ renvaniPlan: null }));
    const p = lastCall();
    expect(p.line_items.map((l) => l.price_data.product_data.name)).toEqual(["Repair", "Service Fee (2%)"]);
    expect(p.payment_intent_data.application_fee_amount).toBe(247);
  });
});
