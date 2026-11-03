import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { closeTestApp } from "../../test-support/close-test-app.js";
import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const enqueueMigrateFileBatchJob = vi.fn();
const uploadFileMock = vi.fn();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  enqueueMigrateFileBatchJob
}));

vi.mock("../../lib/storage.js", () => ({
  uploadFile: uploadFileMock,
  downloadFile: vi.fn(),
  deleteFile: vi.fn(),
  getFileKeyFromUrl: vi.fn()
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
  enqueueMigrateFileBatchJob.mockReset();
  uploadFileMock.mockReset();
  uploadFileMock.mockImplementation(async (key: string) => ({
    url: `https://r2.test/${key}`,
    key
  }));
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await closeTestApp(app);
});

function createAuthContext() {
  const company = fakeDb.seedCompany({
    name: "Photo Migrate Co",
    slug: "photo-migrate",
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@photo-migrate.test",
    firstName: "Pat",
    lastName: "Lee",
    role: "owner"
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return { company, user, authorization: `Bearer ${accessToken}` };
}

describe("migrate photo link preview API", () => {
  it("uploads resumable photo batches and enqueues migrate-file-batch on commit", async () => {
    const { company, authorization } = createAuthContext();
    const bundle = fakeDb.seedImportBundle({
      companyId: company.id,
      wizardStep: 2,
      stepState: { files: [] },
      sourceSystem: "service_fusion"
    });

    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Chris",
      lastName: "Smith",
      displayName: "Chris Smith"
    });
    fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      jobNumber: "JOB-1001",
      title: "Tune-up"
    });

    const uploadResponse = await request(app.server)
      .post(`/api/v1/migrate/photo-link/bundles/${bundle.id}/upload-batch?clientBatchId=batch-1`)
      .set("Authorization", authorization)
      .attach("media/chris-smith/JOB-1001/photo.jpg", Buffer.from("fake-image"), {
        filename: "media/chris-smith/JOB-1001/photo.jpg",
        contentType: "image/jpeg"
      });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.objectCount).toBe(1);

    const previewResponse = await request(app.server)
      .get(`/api/v1/migrate/photo-link/bundles/${bundle.id}/preview`)
      .set("Authorization", authorization);

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.suggestions[0].suggestedCustomerId).toBe(customer.id);

    const commitResponse = await request(app.server)
      .post(`/api/v1/migrate/photo-link/bundles/${bundle.id}/commit-links`)
      .set("Authorization", authorization);

    expect(commitResponse.status).toBe(200);
    expect(commitResponse.body.enqueuedBatches).toBe(1);
    expect(enqueueMigrateFileBatchJob).toHaveBeenCalledTimes(1);
  });

  it("returns NOT_FOUND for cross-tenant bundle access", async () => {
    const ownerA = createAuthContext();
    const ownerB = createAuthContext();
    const bundle = fakeDb.seedImportBundle({
      companyId: ownerA.company.id,
      wizardStep: 2,
      stepState: { files: [] }
    });

    const response = await request(app.server)
      .get(`/api/v1/migrate/photo-link/bundles/${bundle.id}/preview`)
      .set("Authorization", ownerB.authorization);

    expect(response.status).toBe(404);
  });
});
