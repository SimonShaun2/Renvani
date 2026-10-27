import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const {
  applyConnectAccountBrandingMock,
  createConnectOnboardingLinkMock,
  createConnectAccountSessionMock,
  createExpressConnectedAccountMock,
  createExpressDashboardLinkMock,
  retrieveConnectedAccountMock,
  createInvoiceCheckoutSessionMock,
  expireInvoiceCheckoutSessionMock
} = vi.hoisted(() => ({
  applyConnectAccountBrandingMock: vi.fn(),
  createConnectOnboardingLinkMock: vi.fn(),
  createConnectAccountSessionMock: vi.fn(),
  createExpressConnectedAccountMock: vi.fn(),
  createExpressDashboardLinkMock: vi.fn(),
  retrieveConnectedAccountMock: vi.fn(),
  createInvoiceCheckoutSessionMock: vi.fn(),
  expireInvoiceCheckoutSessionMock: vi.fn()
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("../lib/stripe.js", () => ({
  createInvoiceCheckoutSession: createInvoiceCheckoutSessionMock,
  expireInvoiceCheckoutSession: expireInvoiceCheckoutSessionMock,
  applyConnectAccountBranding: applyConnectAccountBrandingMock,
  createConnectOnboardingLink: createConnectOnboardingLinkMock,
  createConnectAccountSession: createConnectAccountSessionMock,
  createExpressConnectedAccount: createExpressConnectedAccountMock,
  createExpressDashboardLink: createExpressDashboardLinkMock,
  retrieveConnectedAccount: retrieveConnectedAccountMock
}));

type StripeConnectServiceModule = typeof import("./stripe-connect.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let stripeConnectService: StripeConnectServiceModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  stripeConnectService = await import("./stripe-connect.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  applyConnectAccountBrandingMock.mockReset();
  createConnectOnboardingLinkMock.mockReset();
  createConnectAccountSessionMock.mockReset();
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
});

function seedCompany() {
  return fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    settings: {}
  });
}

describe("stripe-connect.service", () => {
  it("createOnboardingLink creates an account when none exists and emits an activity event", async () => {
    const company = seedCompany();

    const result = await stripeConnectService.createOnboardingLink(company.id);

    const persistedCompany = fakeDb.getTestState().companies.find((row) => row.id === company.id);
    expect(result.url).toBe("https://stripe.test/onboard");
    expect(createExpressConnectedAccountMock).toHaveBeenCalledWith(company.id, company.name);
    expect(applyConnectAccountBrandingMock).toHaveBeenCalledWith("acct_new_123", "Acme HVAC");
    expect(createConnectOnboardingLinkMock).toHaveBeenCalledWith("acct_new_123");
    expect(persistedCompany?.stripeAccountId).toBe("acct_new_123");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("company.stripe_onboarding_started");
  });

  it("createOnboardingLink reuses an existing account when present", async () => {
    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac",
      stripeAccountId: "acct_existing"
    });

    const result = await stripeConnectService.createOnboardingLink(company.id);

    expect(result.url).toBe("https://stripe.test/onboard");
    expect(createExpressConnectedAccountMock).not.toHaveBeenCalled();
    expect(createConnectOnboardingLinkMock).toHaveBeenCalledWith("acct_existing");
  });

  it("handleOnboardingReturn updates stored company settings from Stripe account status", async () => {
    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac",
      stripeAccountId: "acct_existing",
      settings: {
        stripeConnect: {
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false
        }
      }
    });

    const result = await stripeConnectService.handleOnboardingReturn(company.id);

    const persistedCompany = fakeDb.getTestState().companies.find((row) => row.id === company.id);
    expect(result).toEqual({
      connected: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      stripeAccountId: "acct_existing",
      accountName: "Acme HVAC Services",
      payoutSchedule: "Daily",
      lastPayoutAmount: "4800.00",
      lastPayoutAt: "2026-04-29T15:00:00.000Z",
      platformFeePercent: 2,
      renvaniPlanTier: null
    });
    expect(persistedCompany?.settings).toEqual({
      stripeConnect: {
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true
      }
    });
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("company.stripe_onboarding_completed");
  });

  it("getConnectStatus returns disconnected when no Stripe account exists", async () => {
    const company = seedCompany();

    const result = await stripeConnectService.getConnectStatus(company.id);

    expect(result).toEqual({
      connected: false
    });
    expect(retrieveConnectedAccountMock).not.toHaveBeenCalled();
  });

  it("getConnectStatus returns the expected status shape when connected", async () => {
    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac",
      stripeAccountId: "acct_existing"
    });
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

    const result = await stripeConnectService.getConnectStatus(company.id);

    expect(result).toEqual({
      connected: true,
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
      stripeAccountId: "acct_existing",
      accountName: "Acme HVAC Services",
      payoutSchedule: "Daily",
      lastPayoutAmount: "4800.00",
      lastPayoutAt: "2026-04-29T15:00:00.000Z",
      platformFeePercent: 2,
      renvaniPlanTier: null
    });
  });

  it("createDashboardLink throws CONFLICT when the company is not onboarded", async () => {
    const noAccountCompany = seedCompany();
    const notReadyCompany = fakeDb.seedCompany({
      name: "Ready HVAC",
      slug: "ready-hvac",
      stripeAccountId: "acct_pending"
    });
    retrieveConnectedAccountMock.mockResolvedValueOnce({
      id: "acct_pending",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: true,
      accountName: "Ready HVAC",
      payoutSchedule: "Daily",
      lastPayoutAmount: "0.00",
      lastPayoutAt: null
    });

    await expect(stripeConnectService.createDashboardLink(noAccountCompany.id)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
    await expect(stripeConnectService.createDashboardLink(notReadyCompany.id)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("createDashboardLink returns a Stripe Express dashboard link once charges are enabled", async () => {
    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac",
      stripeAccountId: "acct_existing"
    });

    const result = await stripeConnectService.createDashboardLink(company.id);

    expect(result).toEqual({
      url: "https://stripe.test/dashboard"
    });
    expect(createExpressDashboardLinkMock).toHaveBeenCalledWith("acct_existing");
  });
});
