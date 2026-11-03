import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

const mocks = vi.hoisted(() => ({
  companyRows: [] as Array<{ id: string; stripeAccountId: string | null }>,
  listConnectedAccountPayouts: vi.fn(),
  retrieveConnectedAccountPayout: vi.fn(),
  listStripeDisputes: vi.fn(),
  getStripeDisputeById: vi.fn()
}));

vi.mock("@fsm/db", () => ({
  companies: { id: "id", stripeAccountId: "stripe_account_id", deletedAt: "deleted_at" },
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.companyRows }) }) }) },
  listStripeDisputes: mocks.listStripeDisputes,
  getStripeDisputeById: mocks.getStripeDisputeById
}));
vi.mock("../lib/stripe.js", () => ({
  listConnectedAccountPayouts: mocks.listConnectedAccountPayouts,
  retrieveConnectedAccountPayout: mocks.retrieveConnectedAccountPayout
}));

import {
  getDisputeForCompany,
  getPayoutForCompany,
  getPayoutProvider,
  listDisputesForCompany,
  listPayoutsForCompany,
  registerPayoutProvider
} from "./payouts-disputes.service.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.companyRows = [{ id: companyId, stripeAccountId: "acct_1" }];
});

describe("payouts-disputes.service", () => {
  it("reads payouts from the tenant's Connect account with the default page size", async () => {
    mocks.listConnectedAccountPayouts.mockResolvedValue({ data: [], hasMore: false });
    await expect(listPayoutsForCompany(companyId, {})).resolves.toEqual({ connected: true, data: [], hasMore: false });
    expect(mocks.listConnectedAccountPayouts).toHaveBeenCalledWith("acct_1", { limit: 25 });
  });

  it("returns connected:false without calling Stripe when the tenant has no Connect account", async () => {
    mocks.companyRows = [{ id: companyId, stripeAccountId: null }];
    await expect(listPayoutsForCompany(companyId, {})).resolves.toEqual({ connected: false, data: [], hasMore: false });
    expect(mocks.listConnectedAccountPayouts).not.toHaveBeenCalled();
    await expect(getPayoutForCompany(companyId, "po_1")).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it("404s a payout not found on the tenant's account", async () => {
    mocks.retrieveConnectedAccountPayout.mockResolvedValue(null);
    await expect(getPayoutForCompany(companyId, "po_x")).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it("supports plugging in another payout provider", async () => {
    const before = getPayoutProvider();
    registerPayoutProvider({
      id: "stripe_connect",
      isConnected: () => true,
      listPayouts: async () => ({ data: [], hasMore: true }),
      getPayout: async () => null
    });
    await expect(listPayoutsForCompany(companyId, {})).resolves.toMatchObject({ hasMore: true });
    registerPayoutProvider(before);
    expect(() => getPayoutProvider("missing")).toThrow();
  });

  it("maps dispute errors", async () => {
    mocks.listStripeDisputes.mockRejectedValue(new Error("STRIPE_DISPUTE_INVALID_CURSOR"));
    await expect(listDisputesForCompany(companyId, { cursor: "x" })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    mocks.getStripeDisputeById.mockResolvedValue(null);
    await expect(getDisputeForCompany(companyId, "d")).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
