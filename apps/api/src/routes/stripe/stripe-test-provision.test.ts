import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const {
  addAiQueueJob,
  addInvoiceQueueJob,
  addNotificationQueueJob,
  applyConnectAccountBrandingMock,
  createConnectOnboardingLinkMock,
  createExpressConnectedAccountMock,
  createExpressDashboardLinkMock,
  retrieveConnectedAccountMock,
  createTestProvisionedConnectedAccountMock,
  createInvoiceCheckoutSessionMock,
  expireInvoiceCheckoutSessionMock
} = vi.hoisted(() => ({
  addAiQueueJob: vi.fn(),
  addInvoiceQueueJob: vi.fn(),
  addNotificationQueueJob: vi.fn(),
  applyConnectAccountBrandingMock: vi.fn(),
  createConnectOnboardingLinkMock: vi.fn(),
  createExpressConnectedAccountMock: vi.fn(),
  createExpressDashboardLinkMock: vi.fn(),
  retrieveConnectedAccountMock: vi.fn(),
  createTestProvisionedConnectedAccountMock: vi.fn(),
  createInvoiceCheckoutSessionMock: vi.fn(),
  expireInvoiceCheckoutSessionMock: vi.fn()
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: {
    add: addAiQueueJob
  },
  invoicesQueue: {
    add: addInvoiceQueueJob
  },
  notificationsQueue: {
    add: addNotificationQueueJob
  }
}));

vi.mock("../../lib/stripe.js", () => ({
  createInvoiceCheckoutSession: createInvoiceCheckoutSessionMock,
  expireInvoiceCheckoutSession: expireInvoiceCheckoutSessionMock,
  applyConnectAccountBranding: applyConnectAccountBrandingMock,
  createConnectOnboardingLink: createConnectOnboardingLinkMock,
  createExpressConnectedAccount: createExpressConnectedAccountMock,
  createExpressDashboardLink: createExpressDashboardLinkMock,
  retrieveConnectedAccount: retrieveConnectedAccountMock,
  createTestProvisionedConnectedAccount: createTestProvisionedConnectedAccountMock
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  addAiQueueJob.mockReset();
  addInvoiceQueueJob.mockReset();
  addNotificationQueueJob.mockReset();
  applyConnectAccountBrandingMock.mockReset();
  createConnectOnboardingLinkMock.mockReset();
  createExpressConnectedAccountMock.mockReset();
  createExpressDashboardLinkMock.mockReset();
  retrieveConnectedAccountMock.mockReset();
  createExpressConnectedAccountMock.mockResolvedValue({ id: "acct_new_123" });
  applyConnectAccountBrandingMock.mockResolvedValue(undefined);
  createConnectOnboardingLinkMock.mockResolvedValue({ url: "https://stripe.test/onboard" });
  createExpressDashboardLinkMock.mockResolvedValue({ url: "https://stripe.test/dashboard" });
  retrieveConnectedAccountMock.mockResolvedValue({
    id: "acct_new_123",
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    accountName: "Acme HVAC Services",
    payoutSchedule: "Daily",
    lastPayoutAmount: "4800.00",
    lastPayoutAt: "2026-04-29T15:00:00.000Z"
  });
  createTestProvisionedConnectedAccountMock.mockReset();
  createTestProvisionedConnectedAccountMock.mockResolvedValue({
    id: "acct_test_prov_1",
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    accountName: "Acme HVAC",
    payoutSchedule: null,
    lastPayoutAmount: null,
    lastPayoutAt: null
  });
  process.env.RENVANI_DEPLOYMENT_TIER = "staging";
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  delete process.env.RENVANI_DEPLOYMENT_TIER;
  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  await app.close();
});

function createAuthContext(role: "owner" | "admin" | "office" = "owner") {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}@example.com`,
    firstName: "Ava",
    lastName: "Stone",
    role
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return {
    company,
    user,
    authorization: `Bearer ${accessToken}`
  };
}

describe("POST /stripe/connect/test-provision", () => {
  const url = "/api/v1/stripe/connect/test-provision";

  it("provisions a test account for the owner, persists it, and unblocks the invoice send gate", async () => {
    const owner = createAuthContext("owner");

    const response = await request(app.server).post(url).set("Authorization", owner.authorization).send();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ stripeAccountId: "acct_test_prov_1", status: "active" });
    expect(createTestProvisionedConnectedAccountMock).toHaveBeenCalledTimes(1);
    expect(createTestProvisionedConnectedAccountMock.mock.calls[0]?.[0]).toMatchObject({ companyId: owner.company.id });
    // invoice.service send gate reads company.stripeAccountId.
    const stored = fakeDb.getTestState().companies.find((c) => c.id === owner.company.id);
    expect(stored?.stripeAccountId).toBe("acct_test_prov_1");
    expect((stored?.settings as { stripeConnect?: unknown }).stripeConnect).toEqual({
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true
    });
  });

  it("is idempotent: an existing account is refreshed and never replaced", async () => {
    const owner = createAuthContext("owner");
    owner.company.stripeAccountId = "acct_existing";

    const first = await request(app.server).post(url).set("Authorization", owner.authorization).send();
    const second = await request(app.server).post(url).set("Authorization", owner.authorization).send();

    expect(first.status).toBe(200);
    expect(first.body.stripeAccountId).toBe("acct_existing");
    expect(second.body.stripeAccountId).toBe("acct_existing");
    expect(createTestProvisionedConnectedAccountMock).not.toHaveBeenCalled();
    expect(retrieveConnectedAccountMock).toHaveBeenCalledWith("acct_existing");
  });

  it("is tenant-scoped: provisioning one company does not touch another", async () => {
    const owner = createAuthContext("owner");
    const other = createAuthContext("owner");
    other.company.stripeAccountId = "acct_other";

    const response = await request(app.server).post(url).set("Authorization", owner.authorization).send();

    expect(response.body.stripeAccountId).toBe("acct_test_prov_1");
    expect(fakeDb.getTestState().companies.find((c) => c.id === other.company.id)?.stripeAccountId).toBe("acct_other");
    expect(fakeDb.getTestState().companies.find((c) => c.id === owner.company.id)?.stripeAccountId).toBe("acct_test_prov_1");
  });

  it("returns 403 for non-owners and 401 without auth", async () => {
    const admin = createAuthContext("admin");

    const forbidden = await request(app.server).post(url).set("Authorization", admin.authorization).send();
    const unauthenticated = await request(app.server).post(url).send();

    expect(forbidden.status).toBe(403);
    expect(unauthenticated.status).toBe(401);
    expect(createTestProvisionedConnectedAccountMock).not.toHaveBeenCalled();
  });

  it.each([
    ["production tier", "production", "sk_test_dummy"],
    ["unset tier", undefined, "sk_test_dummy"],
    ["live key", "staging", "sk_live_dummy"]
  ])("returns 404 for %s", async (_label, tier, key) => {
    const owner = createAuthContext("owner");
    if (tier === undefined) delete process.env.RENVANI_DEPLOYMENT_TIER;
    else process.env.RENVANI_DEPLOYMENT_TIER = tier;
    process.env.STRIPE_SECRET_KEY = key;

    const response = await request(app.server).post(url).set("Authorization", owner.authorization).send();

    expect(response.status).toBe(404);
    expect(createTestProvisionedConnectedAccountMock).not.toHaveBeenCalled();
    expect(fakeDb.getTestState().companies.find((c) => c.id === owner.company.id)?.stripeAccountId ?? null).toBeNull();
  });
});
