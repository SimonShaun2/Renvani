import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMigrateFileBatchIdempotencyKey } from "@fsm/types";

const enqueueMigrateFileBatchJob = vi.fn();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  enqueueMigrateFileBatchJob
}));

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

type FakeDbModule = typeof import("../test-support/fake-db.js");

let fakeDb: FakeDbModule;
let scheduleMigrateFileBatchesFromSessionAiInferences: typeof import("./import-migrate-file-batch.service.js").scheduleMigrateFileBatchesFromSessionAiInferences;

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  ({ scheduleMigrateFileBatchesFromSessionAiInferences } = await import("./import-migrate-file-batch.service.js"));
});

describe("import migrate-file-batch enqueue", () => {
  const importBundleId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    enqueueMigrateFileBatchJob.mockReset();
    fakeDb.resetTestState();
  });

  it("returns zero when manifest is absent", async () => {
    const company = fakeDb.seedCompany({ name: "Migrate Batch Co", slug: "migrate-batch" });
    const session = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "importing",
      aiInferences: {}
    });

    const count = await scheduleMigrateFileBatchesFromSessionAiInferences(company.id, session.id);
    expect(count).toBe(0);
    expect(enqueueMigrateFileBatchJob).not.toHaveBeenCalled();
  });

  it("enqueues migrate-file-batch jobs with R2 keys under company imports bundle prefix", async () => {
    const company = fakeDb.seedCompany({ name: "Migrate Batch Co 2", slug: "migrate-batch-2" });
    const session = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "importing",
      aiInferences: {
        migrateFileBatchManifest: {
          importBundleId,
          sourceSystem: "service_fusion",
          batches: [
            {
              batchIndex: 0,
              batchesTotal: 1,
              objects: [{ vendorFileId: "photo-1", relativePath: "media/photo-1.jpg" }]
            }
          ]
        }
      }
    });

    const count = await scheduleMigrateFileBatchesFromSessionAiInferences(company.id, session.id);

    expect(count).toBe(1);
    expect(enqueueMigrateFileBatchJob).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: company.id,
        importSessionId: session.id,
        importBundleId,
        idempotencyKey: buildMigrateFileBatchIdempotencyKey(session.id, 0),
        objects: [
          expect.objectContaining({
            r2Key: `${company.id}/imports/${importBundleId}/media/photo-1.jpg`
          })
        ]
      })
    );
  });
});
