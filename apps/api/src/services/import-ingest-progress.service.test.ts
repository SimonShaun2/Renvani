import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

type FakeDbModule = typeof import("../test-support/fake-db.js");

let fakeDb: FakeDbModule;
let getImportSessionIngestProgress: typeof import("./import-ingest-progress.service.js").getImportSessionIngestProgress;

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  ({ getImportSessionIngestProgress } = await import("./import-ingest-progress.service.js"));
});

beforeEach(() => {
  fakeDb.resetTestState();
});

describe("import-ingest-progress.service", () => {
  it("returns chunk progress for an import session", async () => {
    const company = fakeDb.seedCompany({ name: "Progress Co", slug: "progress-co" });
    const session = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "importing",
      progress: {
        entityType: "customers",
        chunksTotal: 2,
        chunksDone: 1,
        rowsOk: 400,
        rowsFailed: 2
      }
    });

    const response = await getImportSessionIngestProgress(company.id, session.id);

    expect(response.chunk).toEqual({
      entityType: "customers",
      chunksTotal: 2,
      chunksDone: 1,
      rowsOk: 400,
      rowsFailed: 2
    });
  });
});
