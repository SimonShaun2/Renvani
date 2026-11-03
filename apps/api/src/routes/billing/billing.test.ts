import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvCacheForTests } from "@fsm/config";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const { createPlatformBillingCheckoutSessionMock, createStripePlatformCustomerMock } = vi.hoisted(() => ({
  createPlatformBillingCheckoutSessionMock: vi.fn(),
  createStripePlatformCustomerMock: vi.fn()
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("../../lib/stripe.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/stripe.js")>();
  return {
    ...original,
    createPlatformBillingCheckoutSession: createPlatformBillingCheckoutSessionMock,
    createStripePlatformCustomer: createStripePlatformCustomerMock
  };
});

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: {
    stripePlatformBillingMvp: true
  }
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  createPlatformBillingCheckoutSessionMock.mockReset();
  createStripePlatformCustomerMock.mockReset();
  vi.stubEnv("STRIPE_PLATFORM_BILLING_PRICE_ID_FLEX", "price_test_flex");
  vi.stubEnv("STRIPE_PLATFORM_BILLING_PRICE_ID_FLAT", "price_test_flat");
  vi.stubEnv("STRIPE_PLATFORM_BILLING_PRICE_ID", "");
  resetEnvCacheForTests();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe("billing routes", () => {
  it("GET /api/v1/billing/platform/status when MVP flag on", async () => {
    const company = fakeDb.seedCompany({ name: "Billing Co", slug: "billing-co" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@billing.test",
      firstName: "Bill",
      lastName: "Owner",
      role: "owner"
    });
    const accessToken = tokens.generateAccessToken({
      userId: user.id,
      companyId: company.id,
      role: user.role
    });

    const response = await request(app.server)
      .get("/api/v1/billing/platform/status")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      enabled: true,
      subscribed: false,
      checkoutAvailable: true
    });
  });
});
