/**
 * STACK-03 extension — FS-MIGRATE wizard bundles, R2 attachment paths, Clerk org mapping.
 * Synthetic tenants only; extends PR #137 matrix.
 */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryObjectStorageProvider, setObjectStorageProviderForTests } from "@fsm/config/object-storage";
import {
  assertImportBundleObjectKeyBelongsToTenant,
  buildImportBundleObjectKey
} from "@fsm/config/import-bundle-storage";

import { setupTestEnv } from "../../test-support/env-setup.js";
import { seedSyntheticTenantPair } from "../../test-support/synthetic-tenant-fixtures.js";

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

const CLERK_ORG_A = "org_stack03_migrate_a";
const CLERK_ORG_B = "org_stack03_migrate_b";
const CLERK_EMAIL_A = "stack03-migrate-a@clerk-matrix.test";
const CLERK_EMAIL_B = "stack03-migrate-b@clerk-matrix.test";
const TENANT_B_PROBE_TIER = "STACK03-VIP-PROBE-TIER-NAME";

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
      if (token === "clerk-session-migrate-org-a") {
        return {
          clerkUserId: "clerk_user_migrate_a",
          clerkOrganizationId: CLERK_ORG_A,
          email: CLERK_EMAIL_A
        };
      }
      if (token === "clerk-session-migrate-org-b") {
        return {
          clerkUserId: "clerk_user_migrate_b",
          clerkOrganizationId: CLERK_ORG_B,
          email: CLERK_EMAIL_B
        };
      }
      throw new Error("unexpected clerk token in STACK-03 migrate matrix");
    })
  };
});

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");

const WIZARD_JWT_CASES = [
  {
    id: "STACK03-JWT-06",
    path: (bundleId: string) => `/api/v1/migrate/onboarding/sessions/${bundleId}`
  },
  {
    id: "STACK03-JWT-07",
    path: (bundleId: string) => `/api/v1/migrate/onboarding/sessions/${bundleId}/dedupe-preview`
  },
  {
    id: "STACK03-JWT-08",
    path: (bundleId: string) => `/api/v1/migrate/onboarding/sessions/${bundleId}/relational-preview`
  }
] as const;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;
let memoryStorage: MemoryObjectStorageProvider;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  process.env.CLERK_SECRET_KEY = "sk_test_stack03_migrate";
  fakeDb.resetTestState();
  memoryStorage = new MemoryObjectStorageProvider();
  setObjectStorageProviderForTests(memoryStorage);
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  setObjectStorageProviderForTests(null);
  await app.close();
});

function seedWizardBundle(companyId: string, userId: string) {
  return fakeDb.seedImportBundle({
    companyId,
    createdById: userId,
    wizardStep: 2,
    stepState: { files: [], sourceSystem: "servicetitan" }
  });
}

function seedClerkMigratePair() {
  const companyA = fakeDb.seedCompany({
    name: "STACK03 Migrate Clerk A",
    slug: "stack03-migrate-clerk-a",
    settings: { clerk: { organizationId: CLERK_ORG_A } }
  });
  const companyB = fakeDb.seedCompany({
    name: "STACK03 Migrate Clerk B",
    slug: "stack03-migrate-clerk-b",
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

describe("STACK-03 FS-MIGRATE tenant matrix", () => {
  describe.each(WIZARD_JWT_CASES)("$id migrate wizard bundle", ({ path }) => {
    it("returns 404 NOT_FOUND for Org B JWT on Org A bundle", async () => {
      const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "stack03-migrate");
      const bundleA = seedWizardBundle(tenantA.company.id, tenantA.owner.id);
      seedWizardBundle(tenantB.company.id, tenantB.owner.id);

      const response = await request(app.server)
        .get(path(bundleA.id))
        .set("Authorization", tenantB.authorization);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("NOT_FOUND");
      expect(JSON.stringify(response.body)).not.toContain("servicetitan");
    });
  });

  it("STACK03-JWT-09 attachment download-url cross-tenant denied", async () => {
    const { tenantA, tenantB } = seedSyntheticTenantPair(fakeDb, tokens, "stack03-r2");
    const objectKey = buildImportBundleObjectKey(tenantA.company.id, tenantA.company.id, "media/probe.jpg");
    assertImportBundleObjectKeyBelongsToTenant(objectKey, tenantA.company.id);
    const stored = await memoryStorage.putObject(objectKey, Buffer.from("secret"), "image/jpeg");
    const jobA = fakeDb.seedJob({
      companyId: tenantA.company.id,
      customerId: fakeDb.seedCustomer({
        companyId: tenantA.company.id,
        firstName: "A",
        lastName: "Customer",
        email: "a-r2@stack03.test"
      }).id,
      title: "R2 probe job",
      status: "scheduled"
    });
    const attachmentA = fakeDb.seedFileAttachment({
      companyId: tenantA.company.id,
      entityType: "job",
      entityId: jobA.id,
      jobId: jobA.id,
      fileName: "probe.jpg",
      fileUrl: stored.reference,
      uploadedById: tenantA.owner.id
    });

    const response = await request(app.server)
      .get(`/api/v1/attachments/${attachmentA.id}/download-url`)
      .set("Authorization", tenantB.authorization);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
    expect(JSON.stringify(response.body)).not.toContain("memory-signed://");
  });

  it("STACK03-CLK-07 Clerk org B cannot read Org A migrate wizard bundle", async () => {
    const { companyA, companyB, userA, userB } = seedClerkMigratePair();
    const bundleA = seedWizardBundle(companyA.id, userA.id);
    seedWizardBundle(companyB.id, userB.id);

    const response = await request(app.server)
      .get(`/api/v1/migrate/onboarding/sessions/${bundleA.id}`)
      .set("Authorization", "Bearer clerk-session-migrate-org-b");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  it("STACK03-CLK-08 Clerk org mapping resolves tenant B only for org B session", async () => {
    const clerkTenant = await import("../../services/clerk-tenant.service.js");
    const { companyA, companyB } = seedClerkMigratePair();

    const foundA = await clerkTenant.findCompanyByClerkOrganizationId(CLERK_ORG_A);
    const foundB = await clerkTenant.findCompanyByClerkOrganizationId(CLERK_ORG_B);
    const foundWrong = await clerkTenant.findCompanyByClerkOrganizationId("org_unmapped");

    expect(foundA?.id).toBe(companyA.id);
    expect(foundB?.id).toBe(companyB.id);
    expect(foundWrong).toBeNull();
  });

  it("STACK03-R2-01 import bundle keys reject cross-tenant prefixes", () => {
    const companyA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const companyB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const bundleId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const keyA = buildImportBundleObjectKey(companyA, bundleId, "media/photo.jpg");

    expect(() => assertImportBundleObjectKeyBelongsToTenant(keyA, companyB)).toThrow(/tenant scope/);
  });

  it("STACK03-VIP-UNAUTH-01 unauthenticated /api/v1/vip/tiers denied at boundary", async () => {
    const response = await request(app.server).get("/api/v1/vip/tiers");
    expect([401, 404]).toContain(response.status);
    if (response.status === 401) {
      expect(response.body.error).toBe("UNAUTHORIZED");
    }
    expect(JSON.stringify(response.body)).not.toContain(TENANT_B_PROBE_TIER);
  });
});
