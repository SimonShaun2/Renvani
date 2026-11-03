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
  retrieveConnectedAccount: retrieveConnectedAccountMock
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
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
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

describe("stripe connect routes", () => {
  it("POST /stripe/connect/onboard returns a link for owners, 401 without auth, and 403 for non-owners", async () => {
    const owner = createAuthContext("owner");
    const admin = createAuthContext("admin");

    const successResponse = await request(app.server)
      .post("/api/v1/stripe/connect/onboard")
      .set("Authorization", owner.authorization)
      .send();
    const unauthorizedResponse = await request(app.server)
      .post("/api/v1/stripe/connect/onboard")
      .send();
    const forbiddenResponse = await request(app.server)
      .post("/api/v1/stripe/connect/onboard")
      .set("Authorization", admin.authorization)
      .send();

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.url).toBe("https://stripe.test/onboard");
    expect(unauthorizedResponse.status).toBe(401);
    expect(forbiddenResponse.status).toBe(403);
  });

  it("GET /stripe/connect/status returns the current connect status for owner and admin", async () => {
    const owner = createAuthContext("owner");
    owner.company.stripeAccountId = "acct_existing";
    retrieveConnectedAccountMock.mockResolvedValueOnce({
      id: "acct_existing",
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
      accountName: "Acme HVAC Services",
      payoutSchedule: "Daily",
      lastPayoutAmount: "4800.00",
      lastPayoutAt: "2026-04-29T15:00:00.000Z"
    });

    const response = await request(app.server)
      .get("/api/v1/stripe/connect/status")
      .set("Authorization", owner.authorization);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      connected: true,
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
      stripeAccountId: "acct_existing",
      accountName: "Acme HVAC Services",
      payoutSchedule: "Daily",
      lastPayoutAmount: "4800.00",
      lastPayoutAt: "2026-04-29T15:00:00.000Z",
      platformFeePercent: expect.any(Number),
      serviceFeePercent: expect.any(Number)
    });
  });

  it("GET /stripe/connect/return updates connect settings from Stripe", async () => {
    const owner = createAuthContext("owner");
    owner.company.stripeAccountId = "acct_existing";
    owner.company.settings = {
      stripeConnect: {
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false
      }
    };

    const response = await request(app.server)
      .get("/api/v1/stripe/connect/return")
      .set("Authorization", owner.authorization);

    expect(response.status).toBe(200);
    expect(response.body.connected).toBe(true);
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("company.stripe_onboarding_completed");
  });

  it("POST /stripe/connect/dashboard-link returns 409 when the company is not onboarded", async () => {
    const owner = createAuthContext("owner");

    const noAccountResponse = await request(app.server)
      .post("/api/v1/stripe/connect/dashboard-link")
      .set("Authorization", owner.authorization)
      .send();

    owner.company.stripeAccountId = "acct_pending";
    retrieveConnectedAccountMock.mockResolvedValueOnce({
      id: "acct_pending",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: true,
      accountName: "Acme HVAC Services",
      payoutSchedule: "Daily",
      lastPayoutAmount: "0.00",
      lastPayoutAt: null
    });

    const pendingResponse = await request(app.server)
      .post("/api/v1/stripe/connect/dashboard-link")
      .set("Authorization", owner.authorization)
      .send();

    expect(noAccountResponse.status).toBe(409);
    expect(pendingResponse.status).toBe(409);
  });
});
