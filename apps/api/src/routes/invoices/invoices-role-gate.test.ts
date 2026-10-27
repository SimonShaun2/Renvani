import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const {
  addAiQueueJob,
  addInvoiceQueueJob,
  addNotificationQueueJob,
  createInvoiceCheckoutSessionMock,
  expireInvoiceCheckoutSessionMock
} = vi.hoisted(() => ({
  addAiQueueJob: vi.fn(),
  addInvoiceQueueJob: vi.fn(),
  addNotificationQueueJob: vi.fn(),
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
  expireInvoiceCheckoutSession: expireInvoiceCheckoutSessionMock
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
  createInvoiceCheckoutSessionMock.mockReset();
  expireInvoiceCheckoutSessionMock.mockReset();
  createInvoiceCheckoutSessionMock.mockResolvedValue({
    id: "cs_test_123",
    url: null,
    clientSecret: "cs_test_client_secret"
  });
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function createAuthContext(role: "owner" | "admin" | "dispatcher" | "office" | "technician" = "owner") {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: `acme-${role}-${randomUUID()}`,
    timezone: "America/Chicago",
    stripeAccountId: "acct_123"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}-${randomUUID()}@example.com`,
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


const id = "00000000-0000-4000-8000-000000000001";
const itemId = "00000000-0000-4000-8000-000000000002";
const payment = { amount: 10, method: "cash" };

const gatedRoutes: Array<{ method: "get" | "post" | "patch" | "delete"; path: string; body?: object }> = [
  { method: "get", path: "/api/v1/invoices" },
  { method: "post", path: "/api/v1/invoices", body: { customerId: id, title: "Gate" } },
  { method: "get", path: `/api/v1/invoices/${id}` },
  { method: "patch", path: `/api/v1/invoices/${id}`, body: { title: "Gate" } },
  { method: "post", path: `/api/v1/invoices/${id}/send`, body: {} },
  { method: "post", path: `/api/v1/invoices/${id}/record-payment`, body: payment },
  { method: "post", path: `/api/v1/invoices/${id}/payments`, body: payment },
  { method: "post", path: `/api/v1/invoices/${id}/void`, body: { reason: "test" } },
  { method: "post", path: `/api/v1/invoices/${id}/remind`, body: {} },
  { method: "post", path: `/api/v1/invoices/${id}/items`, body: { name: "Labor", quantity: 1, unitPrice: 10 } },
  { method: "patch", path: `/api/v1/invoices/${id}/items/${itemId}`, body: { quantity: 2 } },
  { method: "delete", path: `/api/v1/invoices/${id}/items/${itemId}` },
  { method: "get", path: `/api/v1/invoices/${id}/payments` },
  { method: "post", path: `/api/v1/service-agreements/${id}/retry-payment`, body: {} }
];

function send(route: (typeof gatedRoutes)[number], authorization?: string) {
  let req = request(app.server)[route.method](route.path);
  if (authorization) {
    req = req.set("Authorization", authorization);
  }
  return route.body ? req.send(route.body) : req;
}

describe("invoice routes role gate", () => {
  for (const route of gatedRoutes) {
    const label = `${route.method.toUpperCase()} ${route.path}`;

    it(`${label} returns 401 without auth`, async () => {
      const response = await send(route);
      expect(response.status).toBe(401);
    });

    it(`${label} returns 403 for technician`, async () => {
      const response = await send(route, createAuthContext("technician").authorization);
      expect(response.status).toBe(403);
    });

    for (const role of ["owner", "admin", "dispatcher", "office"] as const) {
      it(`${label} is not 401/403 for ${role}`, async () => {
        const response = await send(route, createAuthContext(role).authorization);
        expect([401, 403]).not.toContain(response.status);
      });
    }
  }
});
