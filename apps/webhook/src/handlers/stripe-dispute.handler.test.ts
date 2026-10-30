import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  retrieve: vi.fn(),
  companyRows: [] as Array<{ id: string; stripeAccountId: string | null }>
}));

vi.mock("@fsm/db", () => ({
  companies: { id: "id", stripeAccountId: "stripe_account_id", deletedAt: "deleted_at" },
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.companyRows }) }) })
  },
  upsertStripeDisputeFromWebhook: mocks.upsert
}));
vi.mock("../lib/stripe-client.js", () => ({ stripe: { paymentIntents: { retrieve: mocks.retrieve } } }));

import {
  buildDisputeSnapshot,
  handleStripeDisputeEvent,
  isStripeDisputeEventType,
  resolveDisputeCompanyId
} from "./stripe-dispute.handler.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const dispute = {
  id: "dp_1",
  object: "dispute",
  amount: 12345,
  currency: "usd",
  status: "needs_response",
  reason: "fraudulent",
  charge: "ch_1",
  payment_intent: "pi_1",
  created: 1_790_000_000,
  evidence_details: { due_by: 1_790_500_000 }
} as unknown as Stripe.Dispute;
const event = { id: "evt_1", created: 1_790_000_100, type: "charge.dispute.created", data: { object: dispute } } as unknown as Stripe.Event;
const log = { warn: vi.fn(), info: vi.fn() } as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.companyRows = [{ id: companyId, stripeAccountId: "acct_1" }];
  mocks.upsert.mockResolvedValue({ applied: true, disputeId: "x" });
});

describe("FS-199 stripe dispute webhook ingest", () => {
  it("only claims charge.dispute.* event types", () => {
    expect(isStripeDisputeEventType("charge.dispute.closed")).toBe(true);
    expect(isStripeDisputeEventType("charge.refunded")).toBe(false);
  });

  it("builds a snapshot with an event-ordered resource version", () => {
    const snap = buildDisputeSnapshot(event, dispute);
    expect(snap).toMatchObject({
      stripeDisputeId: "dp_1",
      stripePaymentIntentId: "pi_1",
      amountMinor: 12345,
      status: "needs_response",
      resourceVersion: "001790000100:evt_1"
    });
    expect(snap.evidenceDueBy?.toISOString()).toBe(new Date(1_790_500_000_000).toISOString());
  });

  it("resolves the tenant only when PI metadata and transfer destination agree", async () => {
    mocks.retrieve.mockResolvedValueOnce({ metadata: { companyId }, transfer_data: { destination: "acct_1" } });
    await expect(resolveDisputeCompanyId(dispute)).resolves.toBe(companyId);
    mocks.retrieve.mockResolvedValueOnce({ metadata: { companyId }, transfer_data: { destination: "acct_other" } });
    await expect(resolveDisputeCompanyId(dispute)).resolves.toBeNull();
    mocks.retrieve.mockResolvedValueOnce({ metadata: {}, transfer_data: { destination: "acct_1" } });
    await expect(resolveDisputeCompanyId(dispute)).resolves.toBeNull();
  });

  it("upserts into the resolved tenant and skips unresolved disputes", async () => {
    await handleStripeDisputeEvent(event, log, async () => companyId);
    expect(mocks.upsert).toHaveBeenCalledWith(companyId, expect.objectContaining({ stripeDisputeId: "dp_1" }));
    mocks.upsert.mockClear();
    await handleStripeDisputeEvent(event, log, async () => null);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
