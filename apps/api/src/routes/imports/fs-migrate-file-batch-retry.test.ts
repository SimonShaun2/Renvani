import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildMigrateFileBatchIdempotencyKey,
  buildMigrateFileBatchJobProgress,
  type MigrateFileBatchJobData
} from "@fsm/types";

import { closeTestApp } from "../../test-support/close-test-app.js";
import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const findLatestMigrateFileBatchJob = vi.fn();
const enqueueMigrateFileBatchFailedObjectsRetry = vi.fn();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fsm/jobs")>();
  return {
    ...actual,
    findLatestMigrateFileBatchJob,
    enqueueMigrateFileBatchFailedObjectsRetry,
    buildMigrateFileBatchFailedObjectsRetryPayload: actual.buildMigrateFileBatchFailedObjectsRetryPayload
  };
});

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: typeof import("../../lib/tokens.js");
let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;

function createOwnerContext(label: string) {
  const company = fakeDb.seedCompany({ name: `${label} Co`, slug: label });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${label}@test.local`,
    firstName: "Test",
    lastName: "Owner",
    role: "owner"
  });
  const token = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: "owner"
  });

  return {
    company,
    authorization: `Bearer ${token}`
  };
}

describe("FS-MIGRATE import file-batch operator retry", () => {
  const importBundleId = "33333333-3333-4333-8333-333333333333";

  const basePayload = (companyId: string, importSessionId: string): MigrateFileBatchJobData => ({
    companyId,
    importSessionId,
    importBundleId,
    sourceSystem: "service_fusion",
    batchIndex: 0,
    batchesTotal: 1,
    idempotencyKey: buildMigrateFileBatchIdempotencyKey(importSessionId, 0),
    objects: [
      { vendorFileId: "ok-1", relativePath: "media/ok-1.jpg" },
      { vendorFileId: "fail-1", relativePath: "media/fail-1.jpg" }
    ]
  });

  beforeAll(async () => {
    buildAppModule = await import("../../app.js");
    fakeDb = await import("../../test-support/fake-db.js");
    tokens = await import("../../lib/tokens.js");
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    fakeDb.resetTestState();
    app = await buildAppModule.buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it("GET file-batch status returns progress and retryAvailable for partial failures", async () => {
    const ctx = createOwnerContext("file-batch-status");
    const session = fakeDb.seedImportSession({
      companyId: ctx.company.id,
      status: "importing",
      fileName: "bundle.zip",
      fileUrl: "https://example.test/bundle.zip"
    });

    const payload = basePayload(ctx.company.id, session.id);
    const progress = buildMigrateFileBatchJobProgress(
      payload,
      ["ok-1"],
      [{ vendorFileId: "fail-1", errorMessage: "timeout" }],
      "partial_failure"
    );

    findLatestMigrateFileBatchJob.mockResolvedValue({
      id: "job-1",
      data: payload,
      progress,
      getState: async () => "failed"
    });

    const response = await request(app.server)
      .get(`/api/v1/imports/${session.id}/file-batches/0`)
      .set("Authorization", ctx.authorization);

    expect(response.statusCode).toBe(200);
    expect(response.body.fileBatch.retryAvailable).toBe(true);
    expect(response.body.fileBatch.progress.objectsFailed).toHaveLength(1);
  });

  it("POST retry-failed enqueues idempotent failed-object-only retry", async () => {
    const ctx = createOwnerContext("file-batch-retry");
    const session = fakeDb.seedImportSession({
      companyId: ctx.company.id,
      status: "importing",
      fileName: "bundle.zip",
      fileUrl: "https://example.test/bundle.zip"
    });

    const payload = basePayload(ctx.company.id, session.id);
    const progress = buildMigrateFileBatchJobProgress(
      payload,
      ["ok-1"],
      [{ vendorFileId: "fail-1", errorMessage: "timeout" }],
      "partial_failure"
    );

    findLatestMigrateFileBatchJob.mockResolvedValue({
      id: "job-1",
      data: payload,
      progress,
      getState: async () => "failed"
    });

    enqueueMigrateFileBatchFailedObjectsRetry.mockResolvedValue("retry-job-9");

    const response = await request(app.server)
      .post(`/api/v1/imports/${session.id}/file-batches/0/retry-failed`)
      .set("Authorization", ctx.authorization);

    expect(response.statusCode).toBe(200);
    expect(response.body.fileBatchRetry.enqueuedQueueJobId).toBe("retry-job-9");
    expect(response.body.fileBatchRetry.idempotencyKey).toContain("failed-objects");
    expect(enqueueMigrateFileBatchFailedObjectsRetry).toHaveBeenCalledOnce();
  });
});
