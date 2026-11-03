import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const { createPriceMock } = vi.hoisted(() => ({ createPriceMock: vi.fn() }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("../lib/stripe.js", () => ({ createServiceAgreementPrice: createPriceMock }));

let fakeDb: typeof import("../test-support/fake-db.js");
let svc: typeof import("./vip-membership-tier-stripe.service.js");

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  svc = await import("./vip-membership-tier-stripe.service.js");
});

function tier(id: string, companyId: string) {
  const now = new Date();
  const row = {
    id,
    companyId,
    name: "Gold",
    description: null,
    monthlyPrice: "19.00",
    discountPercent: "10",
    includedVisitsPerMonth: null,
    stripeMonthlyPriceId: null,
    sortOrder: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null as Date | null
  };
  fakeDb.getTestState().vipMembershipTiers.push(row);
  return row;
}

describe("VIP tier Stripe price tenant guard", () => {
  beforeEach(() => {
    fakeDb.resetTestState();
    createPriceMock.mockReset();
    createPriceMock.mockResolvedValue({ id: "price_new" });
  });

  it("sets the price on the tier owned by companyId", async () => {
    const a = fakeDb.seedCompany({ name: "A", slug: "a", timezone: "America/Chicago" });
    const t = tier("11111111-1111-4111-8111-111111111111", a.id);
    await expect(svc.ensureVipTierStripeMonthlyPrice(a.id, t.id, "Gold", "19.00")).resolves.toBe("price_new");
    expect(fakeDb.getTestState().vipMembershipTiers.find((r) => r.id === t.id)?.stripeMonthlyPriceId).toBe("price_new");
  });

  it("refuses a cross-tenant tier id: NOT_FOUND, no Stripe price created, other tenant's tier untouched", async () => {
    const a = fakeDb.seedCompany({ name: "A", slug: "a", timezone: "America/Chicago" });
    const b = fakeDb.seedCompany({ name: "B", slug: "b", timezone: "America/Chicago" });
    const tb = tier("22222222-2222-4222-8222-222222222222", b.id);
    await expect(svc.ensureVipTierStripeMonthlyPrice(a.id, tb.id, "Gold", "19.00")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(svc.requireVipTierStripePrice(a.id, tb.id, "Gold", "19.00", null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createPriceMock).not.toHaveBeenCalled();
    expect(fakeDb.getTestState().vipMembershipTiers.find((r) => r.id === tb.id)?.stripeMonthlyPriceId).toBeNull();
  });

  it("refuses a soft-deleted tier", async () => {
    const a = fakeDb.seedCompany({ name: "A", slug: "a", timezone: "America/Chicago" });
    const t = tier("33333333-3333-4333-8333-333333333333", a.id);
    t.deletedAt = new Date();
    await expect(svc.ensureVipTierStripeMonthlyPrice(a.id, t.id, "Gold", "19.00")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(createPriceMock).not.toHaveBeenCalled();
  });
});
