import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { IMPORT_SESSION_RECONCILIATION_REPORT_KEY } from "@fsm/types";

import { closeTestApp } from "../../test-support/close-test-app.js";
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

vi.mock("@fsm/config/storage", () => ({
  createSignedDownloadUrl: vi.fn(async (objectKey: string) => ({
    url: `https://signed.example/${objectKey}`,
    objectKey,
    expiresAt: new Date().toISOString()
  }))
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

const sessionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function createAuthContext(role: "owner" | "admin" = "owner") {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: `acme-hvac-${role}`,
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}-${company.id}@example.com`,
    firstName: "Ava",
    lastName: "Stone",
    role
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return { company, authorization: `Bearer ${accessToken}` };
}

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await closeTestApp(app);
});

describe("import reconciliation routes", () => {
  it("returns tenant-scoped reconciliation report for completed session", async () => {
    const owner = createAuthContext("owner");

    fakeDb.getTestState().importSessions.push({
      id: sessionId,
      companyId: owner.company.id,
      createdById: null,
      importBundleId: null,
      sourceSystem: "jobber",
      entityType: "customers",
      status: "completed",
      fileName: "clients.csv",
      fileUrl: "r2://imports/clients.csv",
      totalRows: 5,
      validRows: 5,
      errorRows: 0,
      importedRows: 5,
      skippedRows: 0,
      duplicateRows: 0,
      columnMappings: {},
      validationErrors: [],
      aiInferences: {
        [IMPORT_SESSION_RECONCILIATION_REPORT_KEY]: {
          version: 1,
          importSessionId: sessionId,
          entityType: "customers",
          fileName: "clients.csv",
          status: "completed",
          sourceRowCount: 5,
          committedRowCount: 5,
          skippedRowCount: 0,
          failedRowCount: 0,
          reasonSummaries: [],
          skippedRowsCsvObjectKey: null,
          computedAt: new Date().toISOString()
        }
      },
      progress: {},
      rolledBackAt: null,
      rolledBackById: null,
      completedAt: new Date(),
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    const response = await request(app.server)
      .get(`/api/v1/imports/${sessionId}/reconciliation`)
      .set("Authorization", owner.authorization);

    expect(response.status).toBe(200);
    expect(response.body.report.committedRowCount).toBe(5);
    expect(response.body.skippedRowsDownloadUrl).toBeNull();
  });

  it("denies cross-tenant reconciliation access", async () => {
    const ownerA = createAuthContext("owner");
    const ownerB = createAuthContext("owner");

    fakeDb.getTestState().importSessions.push({
      id: sessionId,
      companyId: ownerA.company.id,
      createdById: null,
      importBundleId: null,
      sourceSystem: "jobber",
      entityType: "customers",
      status: "completed",
      fileName: "clients.csv",
      fileUrl: "r2://imports/clients.csv",
      totalRows: 5,
      validRows: 5,
      errorRows: 0,
      importedRows: 5,
      skippedRows: 0,
      duplicateRows: 0,
      columnMappings: {},
      validationErrors: [],
      aiInferences: {
        [IMPORT_SESSION_RECONCILIATION_REPORT_KEY]: {
          version: 1,
          importSessionId: sessionId,
          entityType: "customers",
          fileName: "clients.csv",
          status: "completed",
          sourceRowCount: 5,
          committedRowCount: 5,
          skippedRowCount: 0,
          failedRowCount: 0,
          reasonSummaries: [],
          skippedRowsCsvObjectKey: null,
          computedAt: new Date().toISOString()
        }
      },
      progress: {},
      rolledBackAt: null,
      rolledBackById: null,
      completedAt: new Date(),
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    const response = await request(app.server)
      .get(`/api/v1/imports/${sessionId}/reconciliation`)
      .set("Authorization", ownerB.authorization);

    expect(response.status).toBe(404);
  });
});
