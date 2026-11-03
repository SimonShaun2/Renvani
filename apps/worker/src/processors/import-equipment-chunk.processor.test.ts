import type { Job } from "bullmq";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../../api/src/test-support/env-setup.js";

setupTestEnv();

const { downloadFileMock, getFileKeyFromUrlMock, commitImportedEquipmentRowsMock, buildResolverMock } =
  vi.hoisted(() => ({
    downloadFileMock: vi.fn(),
    getFileKeyFromUrlMock: vi.fn(),
    commitImportedEquipmentRowsMock: vi.fn(),
    buildResolverMock: vi.fn(),
  }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../../api/src/test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../../api/src/test-support/fake-db.js");
  return {
    ...helper.createDbModuleMock(),
    commitImportedEquipmentRows: commitImportedEquipmentRowsMock,
    buildLineageEquipmentResolver: buildResolverMock,
  };
});

vi.mock("@fsm/config/storage", () => ({
  downloadFile: downloadFileMock,
  getFileKeyFromUrl: getFileKeyFromUrlMock,
}));

type EquipmentProcessorModule = typeof import("./import-equipment-chunk.processor.js");
type FakeDbModule = typeof import("../../../api/src/test-support/fake-db.js");

let processor: EquipmentProcessorModule;
let fakeDb: FakeDbModule;

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const importSessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const csvBuffer = Buffer.from(
  [
    "equipment_id,name,type,customer_id,location_id,install_date,last_service_date",
    "eq-1,Main Furnace,hvac,cust-1,loc-1,2015-09-01,2024-01-15",
  ].join("\n"),
  "utf8",
);

beforeAll(async () => {
  processor = await import("./import-equipment-chunk.processor.js");
  fakeDb = await import("../../../api/src/test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  downloadFileMock.mockReset();
  getFileKeyFromUrlMock.mockReset();
  commitImportedEquipmentRowsMock.mockReset();
  buildResolverMock.mockReset();
  getFileKeyFromUrlMock.mockImplementation((fileUrl: string) => fileUrl);
  downloadFileMock.mockResolvedValue(csvBuffer);
  buildResolverMock.mockResolvedValue({});
  commitImportedEquipmentRowsMock.mockResolvedValue({
    assetsCommitted: 1,
    rowsFailed: 0,
    errors: [],
  });
});

function createJob(data: Record<string, unknown>) {
  return {
    id: "job-import-equipment-commit",
    name: "import-equipment-commit",
    data,
  } as unknown as Job<Record<string, unknown>>;
}

describe("import-equipment-chunk.processor", () => {
  it("maps equipment CSV rows and commits through the db service", async () => {
    fakeDb.seedImportSession({
      id: importSessionId,
      companyId,
      entityType: "assets",
      status: "importing",
      fileName: "equipment.csv",
      fileUrl: "imports/equipment.csv",
      columnMappings: {
        equipment_id: "sourceId",
        name: "name",
        type: "assetType",
        customer_id: "customerSourceId",
        location_id: "propertySourceId",
        install_date: "installDate",
        last_service_date: "lastServiceDate",
      },
    });

    await processor.handleImportEquipmentCommit(
      createJob({
        companyId,
        importSessionId,
        sourceSystem: "service_fusion",
        chunkIndex: 0,
        chunksTotal: 1,
      }),
    );

    expect(buildResolverMock).toHaveBeenCalledWith(companyId, "service_fusion", undefined);
    expect(commitImportedEquipmentRowsMock).toHaveBeenCalledWith(
      {
        companyId,
        importSessionId,
        sourceSystem: "service_fusion",
      },
      [
        expect.objectContaining({
          sourceId: "eq-1",
          name: "Main Furnace",
          assetType: "hvac",
          customerSourceId: "cust-1",
          propertySourceId: "loc-1",
          installDate: "2015-09-01",
          lastServiceDate: "2024-01-15",
        }),
      ],
      {},
    );
  });
});
