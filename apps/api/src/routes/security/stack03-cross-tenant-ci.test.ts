/**
 * STACK-03 — Sam day-one cross-tenant CI matrix (JWT + Clerk parallel auth).
 * Synthetic fixtures only. Wrong-tenant reads must return NOT_FOUND without payload leakage.
 */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";
import {
  seedSyntheticTenantPair,
  seedTenantIsolationBundle
} from "../../test-support/synthetic-tenant-fixtures.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  webhooksQueue: { add: vi.fn() },
  redisConnection: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 1)
  }
}));

vi.mock("../../lib/stripe.js", () => ({
  createInvoiceCheckoutSession: vi.fn(),
  expireInvoiceCheckoutSession: vi.fn()
}));

const CLERK_ORG_A = "org_stack03_clerk_a";
const CLERK_ORG_B = "org_stack03_clerk_b";
const CLERK_EMAIL_A = "stack03-owner-a@clerk-matrix.test";
const CLERK_EMAIL_B = "stack03-owner-b@clerk-matrix.test";

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: {
    clerkAuthParallelJwt: true,
    tenantSessionScopedWrites: false,
    retentionGatesEnqueue: false,
    retentionWinBackEnqueue: false,
    growthCheckPublicScan: false,
    loyaltyRemindersEnabled: false,
    loyaltyRemindersDryRun: true,
    resendEmailEnabled: false,
    outboundSmsEnabled: true,
    stripePlatformBillingMvp: false
  }
}));

vi.mock("../../lib/clerk-auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/clerk-auth.js")>();
  return {
    ...actual,
    isClerkParallelAuthAvailable: vi.fn(() => true),
    verifyClerkBearerToken: vi.fn(async (token: string) => {
      if (token === "clerk-session-org-a") {
        return {
          clerkUserId: "clerk_user_stack03_a",
          clerkOrganizationId: CLERK_ORG_A,
          email: CLERK_EMAIL_A
        };
      }
      if (token === "clerk-session-org-b") {
        return {
          clerkUserId: "clerk_user_stack03_b",
          clerkOrganizationId: CLERK_ORG_B,
          email: CLERK_EMAIL_B
        };
      }
      throw new Error("unexpected clerk token in STACK-03 test");
    })
  };
});

const runTenantAwareTransactionSpy = vi.fn(
  async (_companyId: string, callback: () => Promise<string>) => callback()
);

vi.mock("../../lib/company-scoped-transaction.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/company-scoped-transaction.js")>();
  return {
    ...actual,
    runTenantAwareTransaction: (
      companyId: string,
      callback: () => Promise<string>
    ) => runTenantAwareTransactionSpy(companyId, callback)
  };
});

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");

const STACK03_JWT_READ_CASES = [
  {
    id: "STACK03-JWT-01",
    path: (id: string) => `/api/v1/customers/${id}`,
    resource: "customer" as const
  },
  {
    id: "STACK03-JWT-02",
    path: (id: string) => `/api/v1/imports/${id}`,
    resource: "importSession" as const
  },
  {
    id: "STACK03-JWT-03",
    path: (id: string) => `/api/v1/imports/${id}/errors`,
    resource: "importSession" as const
  },
  {
    id: "STACK03-JWT-04",
    path: (id: string) => `/api/v1/jobs/${id}`,
    resource: "job" as const
  },
  {
    id: "STACK03-JWT-05",
    path: (id: string) => `/api/v1/invoices/${id}`,
    resource: "invoice" as const
  }
] as const;

const STACK03_CLK_READ_CASES = STACK03_JWT_READ_CASES.map((row) => ({
  ...row,
  id: row.id.replace("JWT", "CLK")
}));

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
  process.env.CLERK_SECRET_KEY = "sk_test_stack03";
  fakeDb.resetTestState();
  runTenantAwareTransactionSpy.mockClear();
  app = await buildAppModule.buildApp();
  app.get(
    "/_test/stack03-clerk-scope",
    { preHandler: app.authenticate },
    async (request) => {
      await request.runCompanyScopedTransaction(async () => "ok");
      return { companyId: request.company.id, provider: request.authProvider };
    }
  );
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function seedClerkTenantPair() {
  const companyA = fakeDb.seedCompany({
    name: "STACK03 Clerk Org A",
    slug: "stack03-clerk-a",
    settings: { clerk: { organizationId: CLERK_ORG_A } }
  });
  const companyB = fakeDb.seedCompany({
    name: "STACK03 Clerk Org B",
    slug: "stack03-clerk-b",
    settings: { clerk: { organizationId: CLERK_ORG_B } }
  });
  const userA = fakeDb.seedUser({
    companyId: companyA.id,
    email: CLERK_EMAIL_A,
    firstName: "Owner",
    lastName: "A",
    role: "owner"
  });
  const userB = fakeDb.seedUser({
    companyId: companyB.id,
    email: CLERK_EMAIL_B,
    firstName: "Owner",
    lastName: "B",
    role: "owner"
  });
  return { companyA, companyB, userA, userB };
}

describe("STACK-03 cross-tenant CI matrix", () => {
  describe.each(STACK03_JWT_READ_CASES)("$id JWT wrong-tenant read", ({ path, resource }) => {
    it("returns 404 NOT_FOUND for Org B token on Org A resource", async () => {
      const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "stack03-jwt");
      const bundleA = seedTenantIsolationBundle(fakeDb, tenantA.company.id, tenantA.owner.id);
      seedTenantIsolationBundle(fakeDb, tenantB.company.id, tenantB.owner.id);

      const resourceId = bundleA[resource].id;
      const response = await request(app.server)
        .get(path(resourceId))
        .set("Authorization", tenantB.authorization);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("NOT_FOUND");
    });
  });

  describe.each(STACK03_CLK_READ_CASES)("$id Clerk wrong-tenant read", ({ path, resource }) => {
    it("returns 404 NOT_FOUND when Clerk org maps to tenant B", async () => {
      const { companyA, companyB, userA, userB } = seedClerkTenantPair();
      const bundleA = seedTenantIsolationBundle(fakeDb, companyA.id, userA.id);
      seedTenantIsolationBundle(fakeDb, companyB.id, userB.id);

      const resourceId = bundleA[resource].id;
      const response = await request(app.server)
        .get(path(resourceId))
        .set("Authorization", "Bearer clerk-session-org-b");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("NOT_FOUND");
    });
  });

  it("STACK03-CLK-06 Clerk session maps company_id into scoped write hook", async () => {
    const { companyB } = seedClerkTenantPair();

    const response = await request(app.server)
      .get("/_test/stack03-clerk-scope")
      .set("Authorization", "Bearer clerk-session-org-b");

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe("clerk");
    expect(response.body.companyId).toBe(companyB.id);
    expect(runTenantAwareTransactionSpy).toHaveBeenCalledWith(companyB.id, expect.any(Function));
  });
});
