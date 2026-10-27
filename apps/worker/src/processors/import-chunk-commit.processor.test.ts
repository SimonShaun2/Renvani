import type { Job } from "bullmq";
import * as XLSX from "xlsx";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildImportChunkIdempotencyKey } from "@fsm/jobs";

import { setupTestEnv } from "../../../api/src/test-support/env-setup.js";

setupTestEnv();

const { downloadFileMock, getFileKeyFromUrlMock } = vi.hoisted(() => ({
  downloadFileMock: vi.fn(),
  getFileKeyFromUrlMock: vi.fn(),
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../../api/src/test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

const { commitImportedJobRowsMock, commitImportedEstimateRowsMock, createDbHistoryChunkResolverMock } =
  vi.hoisted(() => ({
    commitImportedJobRowsMock: vi.fn(),
    commitImportedEstimateRowsMock: vi.fn(),
    createDbHistoryChunkResolverMock: vi.fn(async () => ({
      resolveCustomerId: async () => "customer-resolved",
    })),
  }));

vi.mock("@fsm/db", async () => {
  const helper = await import("../../../api/src/test-support/fake-db.js");
  return {
    ...helper.createDbModuleMock(),
    commitImportedJobRows: commitImportedJobRowsMock,
    commitImportedEstimateRows: commitImportedEstimateRowsMock,
    createDbHistoryChunkResolver: createDbHistoryChunkResolverMock,
  };
});

const { persistReportMock } = vi.hoisted(() => ({
  persistReportMock: vi.fn(async () => true),
}));

vi.mock("../lib/persist-import-session-reconciliation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/persist-import-session-reconciliation.js")>();
  return { ...actual, persistImportSessionReconciliationReportBestEffort: persistReportMock };
});

vi.mock("@fsm/config/storage", () => ({
  downloadFile: downloadFileMock,
  getFileKeyFromUrl: getFileKeyFromUrlMock,
}));

type ImportChunkCommitModule = typeof import("./import-chunk-commit.processor.js");
type FakeDbModule = typeof import("../../../api/src/test-support/fake-db.js");

let importChunkCommitProcessor: ImportChunkCommitModule;
let fakeDb: FakeDbModule;

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const importSessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const csvBuffer = Buffer.from(
  [
    "vendor_id,first_name,last_name,email",
    "cust-1,Ada,Lovelace,ada@example.com",
    "cust-2,Grace,Hopper,grace@example.com",
  ].join("\n"),
  "utf8",
);

beforeAll(async () => {
  importChunkCommitProcessor = await import("./import-chunk-commit.processor.js");
  fakeDb = await import("../../../api/src/test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  persistReportMock.mockReset();
  persistReportMock.mockResolvedValue(true);
  downloadFileMock.mockReset();
  getFileKeyFromUrlMock.mockReset();
  getFileKeyFromUrlMock.mockImplementation((fileUrl: string) => fileUrl);
  downloadFileMock.mockResolvedValue(csvBuffer);
  commitImportedJobRowsMock.mockReset();
  commitImportedEstimateRowsMock.mockReset();
  createDbHistoryChunkResolverMock.mockReset();
  createDbHistoryChunkResolverMock.mockResolvedValue({
    resolveCustomerId: async () => "customer-resolved",
  });
  commitImportedJobRowsMock.mockResolvedValue({ rowsCommitted: 1, rowsFailed: 0, errors: [] });
  commitImportedEstimateRowsMock.mockResolvedValue({ rowsCommitted: 1, rowsFailed: 0, errors: [] });
});

function createJob(data: Record<string, unknown>) {
  const updateProgress = vi.fn(async () => undefined);

  return {
    job: {
      id: "job-import-chunk-commit",
      name: "import-chunk-commit",
      data,
      updateProgress,
    } as unknown as Job<Record<string, unknown>>,
    updateProgress,
  };
}

function seedSession() {
  return fakeDb.seedImportSession({
    id: importSessionId,
    companyId,
    entityType: "customers",
    status: "importing",
    fileName: "customers.csv",
    fileUrl: "imports/customers.csv",
    columnMappings: {
      vendor_id: "sourceId",
      first_name: "firstName",
      last_name: "lastName",
      email: "email",
    },
  });
}

describe("import-chunk-commit.processor", () => {
  it("commits a customer chunk with lineage upsert and session progress", async () => {
    seedSession();

    const idempotencyKey = buildImportChunkIdempotencyKey(importSessionId, "customers", 0);
    const { job, updateProgress } = createJob({
      companyId,
      importSessionId,
      sourceSystem: "jobber",
      entityType: "customers",
      chunkIndex: 0,
      chunksTotal: 1,
      cursor: { rowOffset: 0 },
      idempotencyKey,
      rowWindow: { start: 0, end: 2 },
    });

    await importChunkCommitProcessor.handleImportChunkCommit(job);

    const testState = fakeDb.getTestState();
    expect(testState.customers).toHaveLength(2);
    expect(testState.customers[0]?.sourceSystem).toBe("jobber");
    expect(testState.customers[0]?.sourceId).toBe("cust-1");
    expect(testState.importChunkRuns).toHaveLength(1);
    expect(testState.importChunkRuns[0]?.status).toBe("completed");
    expect(testState.importSessions[0]?.status).toBe("completed");
    expect(testState.importSessions[0]?.progress).toMatchObject({
      chunksDone: 1,
      chunksTotal: 1,
      rowsOk: 2,
    });
    expect(updateProgress).toHaveBeenCalledWith(100);
  });

  it("is idempotent when the same chunk is re-queued after completion", async () => {
    seedSession();

    const idempotencyKey = buildImportChunkIdempotencyKey(importSessionId, "customers", 0);
    const payload = {
      companyId,
      importSessionId,
      sourceSystem: "jobber",
      entityType: "customers",
      chunkIndex: 0,
      chunksTotal: 1,
      cursor: { rowOffset: 0 },
      idempotencyKey,
      rowWindow: { start: 0, end: 1 },
    };

    await importChunkCommitProcessor.handleImportChunkCommit(createJob(payload).job);
    await importChunkCommitProcessor.handleImportChunkCommit(createJob(payload).job);

    const testState = fakeDb.getTestState();
    expect(testState.customers).toHaveLength(1);
    expect(testState.importChunkRuns).toHaveLength(1);
    expect(testState.importSessions[0]?.progress).toMatchObject({ chunksDone: 1, rowsOk: 1 });
  });

  it("maps job history CSV rows into commitImportedJobRows", async () => {
    fakeDb.seedImportSession({
      id: importSessionId,
      companyId,
      entityType: "jobs",
      status: "importing",
      fileName: "jobs.csv",
      fileUrl: "imports/jobs.csv",
      columnMappings: {
        job_id: "sourceId",
        job_number: "jobNumber",
        customer_id: "customerSourceId",
        title: "title",
        status: "status",
        completed_at: "actualEnd",
        total: "invoiceTotal",
      },
    });

    downloadFileMock.mockResolvedValue(
      Buffer.from(
        [
          "job_id,job_number,customer_id,title,status,completed_at,total",
          "job-100,J-100,cust-job-1,AC repair,Complete,2021-05-10T14:00:00Z,450.00",
        ].join("\n"),
        "utf8",
      ),
    );

    const idempotencyKey = buildImportChunkIdempotencyKey(importSessionId, "jobs", 0);
    await importChunkCommitProcessor.handleImportChunkCommit(
      createJob({
        companyId,
        importSessionId,
        sourceSystem: "jobber",
        entityType: "jobs",
        chunkIndex: 0,
        chunksTotal: 1,
        cursor: { rowOffset: 0 },
        idempotencyKey,
        rowWindow: { start: 0, end: 1 },
      }).job,
    );

    expect(commitImportedJobRowsMock).toHaveBeenCalledTimes(1);
    const rows = commitImportedJobRowsMock.mock.calls[0]?.[1];
    expect(rows?.[0]).toMatchObject({
      sourceId: "job-100",
      jobNumber: "J-100",
      customerSourceId: "cust-job-1",
      title: "AC repair",
      status: "Complete",
      invoiceTotal: "450.00",
    });
    expect(rows?.[0]?.actualEnd).toEqual(new Date("2021-05-10T14:00:00.000Z"));
  });

  it("maps estimate history CSV rows into commitImportedEstimateRows", async () => {
    fakeDb.seedImportSession({
      id: importSessionId,
      companyId,
      entityType: "estimates",
      status: "importing",
      fileName: "estimates.csv",
      fileUrl: "imports/estimates.csv",
      columnMappings: {
        estimate_id: "sourceId",
        estimate_number: "estimateNumber",
        customer_id: "customerSourceId",
        job_id: "jobSourceId",
        status: "status",
        total: "total",
        sent_at: "sentAt",
      },
    });

    downloadFileMock.mockResolvedValue(
      Buffer.from(
        [
          "estimate_id,estimate_number,customer_id,job_id,status,total,sent_at",
          "est-9,EST-9,cust-est-1,job-22,Approved,1200.00,2020-03-01T10:00:00Z",
        ].join("\n"),
        "utf8",
      ),
    );

    const idempotencyKey = buildImportChunkIdempotencyKey(importSessionId, "estimates", 0);
    await importChunkCommitProcessor.handleImportChunkCommit(
      createJob({
        companyId,
        importSessionId,
        sourceSystem: "service_fusion",
        entityType: "estimates",
        chunkIndex: 0,
        chunksTotal: 1,
        cursor: { rowOffset: 0 },
        idempotencyKey,
        rowWindow: { start: 0, end: 1 },
      }).job,
    );

    expect(commitImportedEstimateRowsMock).toHaveBeenCalledTimes(1);
    const rows = commitImportedEstimateRowsMock.mock.calls[0]?.[1];
    expect(rows?.[0]).toMatchObject({
      sourceId: "est-9",
      estimateNumber: "EST-9",
      jobSourceId: "job-22",
      status: "Approved",
      total: "1200.00",
    });
    expect(rows?.[0]?.sentAt).toEqual(new Date("2020-03-01T10:00:00.000Z"));
  });

  it("upserts existing customers by source lineage without duplicating rows", async () => {
    seedSession();
    fakeDb.seedCustomer({
      companyId,
      firstName: "Old",
      lastName: "Name",
      sourceSystem: "jobber",
      sourceId: "cust-1",
    });

    const idempotencyKey = buildImportChunkIdempotencyKey(importSessionId, "customers", 0);
    await importChunkCommitProcessor.handleImportChunkCommit(
      createJob({
        companyId,
        importSessionId,
        sourceSystem: "jobber",
        entityType: "customers",
        chunkIndex: 0,
        chunksTotal: 1,
        cursor: {},
        idempotencyKey,
        rowWindow: { start: 0, end: 1 },
      }).job,
    );

    const testState = fakeDb.getTestState();
    expect(testState.customers).toHaveLength(1);
    expect(testState.customers[0]?.firstName).toBe("Ada");
  });

  it("commits customer rows from an XLSX upload", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["vendor_id", "first_name", "last_name", "email"],
      ["cust-xlsx", "Linus", "Torvalds", "linus@example.com"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Customers");
    const xlsxBuffer = Buffer.from(
      XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer,
    );

    downloadFileMock.mockResolvedValue(xlsxBuffer);
    fakeDb.seedImportSession({
      id: importSessionId,
      companyId,
      entityType: "customers",
      status: "importing",
      fileName: "customers.xlsx",
      fileUrl: "imports/customers.xlsx",
      columnMappings: {
        vendor_id: "sourceId",
        first_name: "firstName",
        last_name: "lastName",
        email: "email",
      },
    });

    const idempotencyKey = buildImportChunkIdempotencyKey(importSessionId, "customers", 0);
    await importChunkCommitProcessor.handleImportChunkCommit(
      createJob({
        companyId,
        importSessionId,
        sourceSystem: "service_fusion",
        entityType: "customers",
        chunkIndex: 0,
        chunksTotal: 1,
        cursor: { rowOffset: 0 },
        idempotencyKey,
        rowWindow: { start: 0, end: 1 },
      }).job,
    );

    const testState = fakeDb.getTestState();
    expect(testState.customers).toHaveLength(1);
    expect(testState.customers[0]?.sourceId).toBe("cust-xlsx");
    expect(testState.customers[0]?.firstName).toBe("Linus");
  });

  describe("reconciliation report trigger", () => {
    function chunkPayload(chunkIndex: number, rowWindow: { start: number; end: number }) {
      return {
        companyId,
        importSessionId,
        sourceSystem: "jobber",
        entityType: "customers",
        chunkIndex,
        chunksTotal: 2,
        cursor: { rowOffset: rowWindow.start },
        idempotencyKey: buildImportChunkIdempotencyKey(importSessionId, "customers", chunkIndex),
        rowWindow,
      };
    }

    it("writes the report when the session completes even if the last chunk number finishes first", async () => {
      seedSession();

      await importChunkCommitProcessor.handleImportChunkCommit(createJob(chunkPayload(1, { start: 1, end: 2 })).job);
      expect(fakeDb.getTestState().importSessions[0]?.status).not.toBe("completed");
      expect(persistReportMock).not.toHaveBeenCalled();

      await importChunkCommitProcessor.handleImportChunkCommit(createJob(chunkPayload(0, { start: 0, end: 1 })).job);
      expect(fakeDb.getTestState().importSessions[0]?.status).toBe("completed");
      expect(persistReportMock).toHaveBeenCalledTimes(1);
    });

    it("does not fail the chunk when the report write throws", async () => {
      seedSession();
      persistReportMock.mockRejectedValueOnce(new Error("storage down"));

      const payload = { ...chunkPayload(0, { start: 0, end: 2 }), chunksTotal: 1 };
      await expect(
        importChunkCommitProcessor.handleImportChunkCommit(createJob(payload).job),
      ).resolves.toBeUndefined();

      const testState = fakeDb.getTestState();
      expect(persistReportMock).toHaveBeenCalledTimes(1);
      expect(testState.importChunkRuns[0]?.status).toBe("completed");
      expect(testState.importSessions[0]?.status).toBe("completed");
    });
  });
});
