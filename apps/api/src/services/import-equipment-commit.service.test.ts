import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const enqueueImportEquipmentCommitJob = vi.fn();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  enqueueImportEquipmentCommitJob,
  IMPORT_EQUIPMENT_COMMIT_JOB_NAME: "import-equipment-commit",
  buildImportEquipmentCommitJobId: (importSessionId: string, chunkIndex: number) =>
    `import-equipment-commit-${importSessionId}-${chunkIndex}`,
}));

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

type FakeDbModule = typeof import("../test-support/fake-db.js");

let fakeDb: FakeDbModule;
let scheduleEquipmentImportChunksFromSessionAiInferences: typeof import("./import-equipment-commit.service.js").scheduleEquipmentImportChunksFromSessionAiInferences;

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  ({ scheduleEquipmentImportChunksFromSessionAiInferences } = await import(
    "./import-equipment-commit.service.js"
  ));
});

describe("import equipment commit enqueue", () => {
  beforeEach(() => {
    enqueueImportEquipmentCommitJob.mockReset();
    fakeDb.resetTestState();
  });

  it("returns zero when equipmentChunkPlan is absent", async () => {
    const company = fakeDb.seedCompany({ name: "Equip Co", slug: "equip-co" });
    const session = fakeDb.seedImportSession({
      companyId: company.id,
      entityType: "assets",
      fileName: "equipment.csv",
      fileUrl: "https://r2.test/equipment.csv",
      status: "importing",
      aiInferences: {},
    });

    const count = await scheduleEquipmentImportChunksFromSessionAiInferences(company.id, session.id);
    expect(count).toBe(0);
    expect(enqueueImportEquipmentCommitJob).not.toHaveBeenCalled();
  });

  it("enqueues import-equipment-commit jobs from session aiInferences plan", async () => {
    const company = fakeDb.seedCompany({ name: "Equip Co 2", slug: "equip-co-2" });
    const importSessionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const session = fakeDb.seedImportSession({
      id: importSessionId,
      companyId: company.id,
      entityType: "assets",
      fileName: "equipment.csv",
      fileUrl: "https://r2.test/equipment.csv",
      status: "importing",
      aiInferences: {
        equipmentChunkPlan: {
          companyId: company.id,
          importSessionId,
          sourceSystem: "service_fusion",
          chunksTotal: 2,
        },
      },
    });

    const count = await scheduleEquipmentImportChunksFromSessionAiInferences(company.id, session.id);

    expect(count).toBe(2);
    expect(enqueueImportEquipmentCommitJob).toHaveBeenCalledTimes(2);
    expect(enqueueImportEquipmentCommitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: company.id,
        importSessionId: session.id,
        sourceSystem: "service_fusion",
        chunkIndex: 0,
        chunksTotal: 2,
      }),
    );
  });
});
