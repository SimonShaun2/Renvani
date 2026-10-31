import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const { createSessionMock } = vi.hoisted(() => ({ createSessionMock: vi.fn() }));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: createSessionMock, retrieve: vi.fn(), expire: vi.fn() } }
  }))
}));

// Embedded is ON: forceHosted must still produce a hosted session.
vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: { stripeRenvaniEmbeddedCheckout: true }
}));

type StripeLib = typeof import("./stripe.js");
let createInvoiceCheckoutSession: StripeLib["createInvoiceCheckoutSession"];

beforeAll(async () => {
  ({ createInvoiceCheckoutSession } = await import("./stripe.js"));
});

type Params = {
  ui_mode?: string;
  success_url?: string;
  cancel_url?: string;
  return_url?: string;
  payment_intent_data: Record<string, unknown>;
  line_items: unknown[];
};

function input(overrides: Partial<Parameters<StripeLib["createInvoiceCheckoutSession"]>[0]> = {}) {
  return {
    companyId: "co_1",
    invoiceId: "inv_1",
    customerId: "cus_1",
    customerEmail: "c@example.com",
    companyStripeAccountId: "acct_1",
    companyName: "Acme HVAC",
    invoiceNumber: "INV-0001",
    total: "100.00",
    items: [{ name: "Repair", description: null, quantity: "1", total: "100.00" }],
    paymentToken: "tok_1",
    renvaniPlan: "flex" as const,
    ...overrides
  };
}

describe("createInvoiceCheckoutSession forceHosted", () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    createSessionMock.mockResolvedValue({ id: "cs_h", url: "https://checkout.stripe.test/cs_h", client_secret: "cs_secret" });
  });

  it("creates a hosted session (success/cancel URLs back to /pay/:token, no client secret) even with embedded on", async () => {
    const result = await createInvoiceCheckoutSession(input({ forceHosted: true, idempotencyKey: "k1" }));
    const [params, options] = createSessionMock.mock.calls.at(-1)! as [Params, { idempotencyKey: string }];
    expect(params.ui_mode).not.toBe("embedded");
    expect(params.return_url).toBeUndefined();
    expect(params.success_url).toContain("/pay/tok_1");
    expect(params.cancel_url).toContain("/pay/tok_1?status=cancelled");
    expect(options).toEqual({ idempotencyKey: "k1" });
    expect(result).toEqual({ id: "cs_h", url: "https://checkout.stripe.test/cs_h", clientSecret: null });
  });

  it("Flex: payment_intent_data (destination, 2% app fee, metadata) and line items identical to embedded", async () => {
    await createInvoiceCheckoutSession(input());
    const embedded = createSessionMock.mock.calls.at(-1)![0] as Params;
    await createInvoiceCheckoutSession(input({ forceHosted: true }));
    const hosted = createSessionMock.mock.calls.at(-1)![0] as Params;
    expect(embedded.ui_mode).toBe("embedded");
    expect(hosted.payment_intent_data).toEqual(embedded.payment_intent_data);
    expect(hosted.line_items).toEqual(embedded.line_items);
    expect(hosted.payment_intent_data).toMatchObject({
      application_fee_amount: 200,
      transfer_data: { destination: "acct_1" },
      metadata: { companyId: "co_1", invoiceId: "inv_1", customerId: "cus_1", invoiceAmountCents: "10000", serviceFeeCents: "200" }
    });
  });

  it("Flat: hosted session has no application fee", async () => {
    await createInvoiceCheckoutSession(input({ forceHosted: true, renvaniPlan: "flat" }));
    const hosted = createSessionMock.mock.calls.at(-1)![0] as Params;
    expect(hosted.payment_intent_data.application_fee_amount).toBeUndefined();
    expect(hosted.payment_intent_data).toMatchObject({ transfer_data: { destination: "acct_1" } });
  });

  it("no idempotency key → no options arg change for existing callers", async () => {
    await createInvoiceCheckoutSession(input());
    expect(createSessionMock.mock.calls.at(-1)![1]).toBeUndefined();
  });
});
