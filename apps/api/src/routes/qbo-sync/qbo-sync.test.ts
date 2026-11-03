import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { QBO_SYNC_CONTRACT_VERSION, type QboSyncStatusV1 } from "@fsm/types";

import { setupTestEnv } from "../../test-support/env-setup.js";

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
  operatorQueue: { add: vi.fn() },
  exportsQueue: { add: vi.fn() },
  growthQueue: { add: vi.fn() },
  redisConnection: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 1)
  }
}));

vi.mock("../../services/qbo-sync.service.js", () => ({
  getQboSyncStatus: vi.fn(),
  getQboMappingBoard: vi.fn(),
  upsertQboMappings: vi.fn(),
  fetchQboCatalog: vi.fn(),
  retryQboSyncIssue: vi.fn()
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type QboSyncServiceModule = typeof import("../../services/qbo-sync.service.js");

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let qboSyncService: QboSyncServiceModule;
let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;

const tenantCompanyId = "11111111-1111-4111-8111-111111111111";

const sampleStatus: QboSyncStatusV1 = {
  contractVersion: QBO_SYNC_CONTRACT_VERSION,
  companyId: tenantCompanyId,
  sandboxOnly: true,
  connection: { phase: "disconnected", realmId: null, connectedAt: null },
  sync: {
    status: "idle",
    lastSuccessfulAt: null,
    lastAttemptAt: null,
    pendingIssueCount: 0,
    mappedCounts: { priceBookItem: 0, taxCode: 0, paymentMethod: 0 }
  },
  recentIssues: []
};

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
  qboSyncService = await import("../../services/qbo-sync.service.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  vi.mocked(qboSyncService.getQboSyncStatus).mockResolvedValue(sampleStatus);
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function createOwnerContext() {
  const company = fakeDb.seedCompany({
    id: tenantCompanyId,
    name: "Field Co",
    slug: "field-co",
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@field.test",
    firstName: "Olivia",
    lastName: "Owner",
    role: "owner"
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return { authorization: `Bearer ${accessToken}` };
}

describe("GET /api/v1/qbo-sync/status (FS-133)", () => {
  it("returns sync status for owner", async () => {
    const owner = createOwnerContext();

    const response = await request(app.server)
      .get("/api/v1/qbo-sync/status")
      .set("Authorization", owner.authorization);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(sampleStatus);
    expect(qboSyncService.getQboSyncStatus).toHaveBeenCalledWith(tenantCompanyId);
  });

  it("rejects dispatcher role", async () => {
    const company = fakeDb.seedCompany({
      name: "Field Co",
      slug: "field-co-dispatch",
      timezone: "America/Chicago"
    });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "dispatch@field.test",
      firstName: "Dee",
      lastName: "Dispatch",
      role: "dispatcher"
    });
    const accessToken = tokens.generateAccessToken({
      userId: user.id,
      companyId: company.id,
      role: user.role
    });

    const response = await request(app.server)
      .get("/api/v1/qbo-sync/status")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.statusCode).toBe(403);
  });
});
