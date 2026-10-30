import type { Job } from "bullmq";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../../api/src/test-support/env-setup.js";

setupTestEnv();

const {
  addAiQueueJob,
  downloadFileMock,
  getFileKeyFromUrlMock,
  uploadFileMock,
  mapCsvColumnsMock,
  recordImportAiObservationMock
} = vi.hoisted(() => ({
  addAiQueueJob: vi.fn(),
  downloadFileMock: vi.fn(),
  getFileKeyFromUrlMock: vi.fn(),
  uploadFileMock: vi.fn(async (key: string) => ({ key, url: `https://r2.test/${key}` })),
  mapCsvColumnsMock: vi.fn(),
  recordImportAiObservationMock: vi.fn(async () => undefined)
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../../api/src/test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../../api/src/test-support/fake-db.js");
  return {
    ...helper.createDbModuleMock(),
    resolveSourceSystemForPriceBookImport: () => "manual_csv",
  };
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: {
    add: addAiQueueJob
  }
}));

vi.mock("@fsm/config/storage", () => ({
  downloadFile: downloadFileMock,
  getFileKeyFromUrl: getFileKeyFromUrlMock,
  uploadFile: uploadFileMock
}));

vi.mock("@fsm/ai", () => ({
  mapCsvColumns: mapCsvColumnsMock,
  recordImportAiObservation: recordImportAiObservationMock
}));

type CsvImportProcessorModule = typeof import("./csv-import.processor.js");
type FakeDbModule = typeof import("../../../api/src/test-support/fake-db.js");

let csvImportProcessor: CsvImportProcessorModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  csvImportProcessor = await import("./csv-import.processor.js");
  fakeDb = await import("../../../api/src/test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  addAiQueueJob.mockReset();
  downloadFileMock.mockReset();
  getFileKeyFromUrlMock.mockReset();
  mapCsvColumnsMock.mockReset();
  getFileKeyFromUrlMock.mockImplementation((fileUrl: string) => fileUrl);
});

function createJob(name: string, data: Record<string, unknown>) {
  const updateProgress = vi.fn(async () => undefined);

  return {
    job: {
      id: `job-${name}`,
      name,
      data,
      updateProgress
    } as unknown as Job<Record<string, unknown>>,
    updateProgress
  };
}

describe("csv-import.processor", () => {
  it("map-csv-columns stores the mapping and transitions the session to mapping", async () => {
    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac"
    });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "imports/company/customers.csv",
      status: "uploaded"
    });
    downloadFileMock.mockResolvedValue(Buffer.from("First Name,Email\nChris,chris@example.com"));
    mapCsvColumnsMock.mockResolvedValue({
      "First Name": "firstName",
      Email: "email"
    });

    const { job } = createJob("map-csv-columns", {
      companyId: company.id,
      importSessionId: importSession.id
    });

    await csvImportProcessor.handleMapCsvColumns(job);

    const storedSession = fakeDb.getTestState().importSessions.find((row) => row.id === importSession.id);
    expect(mapCsvColumnsMock).toHaveBeenCalled();
    expect(storedSession?.status).toBe("mapping");
    expect(storedSession?.columnMappings).toEqual({
      "First Name": "firstName",
      Email: "email"
    });
  });

  it("map-csv-columns dedupes when the session already left uploaded state", async () => {
    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac-dedupe"
    });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "imports/company/customers.csv",
      status: "mapping",
      columnMappings: { Email: "email" }
    });

    const { job } = createJob("map-csv-columns", {
      companyId: company.id,
      importSessionId: importSession.id,
      idempotencyKey: `${importSession.id}:map-csv-columns`
    });

    await csvImportProcessor.handleMapCsvColumns(job);

    expect(mapCsvColumnsMock).not.toHaveBeenCalled();
    expect(downloadFileMock).not.toHaveBeenCalled();
    const receipt = fakeDb.getTestState().activityEvents.at(-1);
    expect(receipt?.payload).toMatchObject({
      stepKind: "map-csv-columns",
      state: "deduped_completed"
    });
  });

  it("validate-csv-rows collects all errors and detects duplicates without aborting", async () => {
    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac"
    });
    fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Existing",
      lastName: "Customer",
      email: "duplicate@example.com"
    });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "imports/company/customers.csv",
      status: "preview",
      columnMappings: {
        "First Name": "firstName",
        "Last Name": "lastName",
        Email: "email"
      }
    });
    downloadFileMock.mockResolvedValue(
      Buffer.from(
        [
          "First Name,Last Name,Email",
          "Chris,Pine,chris@example.com",
          "Jamie,,jamie@example.com",
          "Taylor,River,duplicate@example.com"
        ].join("\n")
      )
    );

    const { job, updateProgress } = createJob("validate-csv-rows", {
      companyId: company.id,
      importSessionId: importSession.id
    });

    await csvImportProcessor.handleValidateCsvRows(job);

    const storedSession = fakeDb.getTestState().importSessions.find((row) => row.id === importSession.id);
    expect(storedSession?.totalRows).toBe(3);
    expect(storedSession?.validRows).toBe(1);
    expect(storedSession?.errorRows).toBe(1);
    expect(storedSession?.duplicateRows).toBe(1);
    expect(storedSession?.validationErrors).toEqual([
      {
        row: 3,
        field: "firstName",
        message: "Required field missing",
        value: "Jamie"
      }
    ]);
    expect(updateProgress).toHaveBeenCalledWith(100);
  });

  it("validate-csv-rows parses xlsx uploads and stores chunk commit manifest when sourceId is mapped", async () => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Customer ID", "First Name", "Last Name"],
      ["c1", "Chris", "Pine"],
      ["c2", "Jamie", "Lee"]
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Customers");
    const buffer = Buffer.from(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);

    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac-xlsx"
    });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.xlsx",
      fileUrl: "imports/company/customers.xlsx",
      status: "preview",
      entityType: "customers",
      aiInferences: { sourceSystem: "jobber" },
      columnMappings: {
        "Customer ID": "sourceId",
        "First Name": "firstName",
        "Last Name": "lastName"
      }
    });
    downloadFileMock.mockResolvedValue(buffer);

    const { job } = createJob("validate-csv-rows", {
      companyId: company.id,
      importSessionId: importSession.id
    });

    await csvImportProcessor.handleValidateCsvRows(job);

    const storedSession = fakeDb.getTestState().importSessions.find((row) => row.id === importSession.id);
    const manifest = storedSession?.aiInferences.importChunkCommitManifest as {
      entityType?: string;
      chunks?: Array<{ chunksTotal: number }>;
    };

    expect(storedSession?.totalRows).toBe(2);
    expect(manifest?.entityType).toBe("customers");
    expect(manifest?.chunks?.[0]?.chunksTotal).toBe(1);
    expect(storedSession?.progress).toMatchObject({
      entityType: "customers",
      chunksTotal: 1,
      chunksDone: 0,
      rowsOk: 0,
      rowsFailed: 0
    });
  });

  it("execute-import rejects a payments file as unsupported instead of committing it as customers", async () => {
    const company = fakeDb.seedCompany({ name: "Pay Co", slug: "pay-co" });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      entityType: "payments" as never,
      fileName: "payments.csv",
      fileUrl: "imports/company/payments.csv",
      status: "importing",
      columnMappings: { "First Name": "firstName", "Last Name": "lastName", Amount: "amount" }
    });
    downloadFileMock.mockResolvedValue(Buffer.from("First Name,Last Name,Amount\nPat,Payer,50.00"));

    const { job } = createJob("execute-import", { companyId: company.id, importSessionId: importSession.id });
    await expect(csvImportProcessor.handleExecuteImport(job)).resolves.toBeUndefined();

    const stored = fakeDb.getTestState().importSessions.find((row) => row.id === importSession.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.errorMessage).toContain("UNSUPPORTED_ENTITY_TYPE");
    expect(stored?.errorMessage).toContain("payments");
    expect(fakeDb.getTestState().customers.filter((row) => row.companyId === company.id)).toHaveLength(0);
  });

  it("execute-import does not write properties without a chunk plan as customers", async () => {
    const company = fakeDb.seedCompany({ name: "Prop Co", slug: "prop-co" });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      entityType: "properties" as never,
      fileName: "properties.csv",
      fileUrl: "imports/company/properties.csv",
      status: "importing",
      columnMappings: { "First Name": "firstName", Street: "addressLine1" }
    });
    downloadFileMock.mockResolvedValue(Buffer.from("First Name,Street\nPat,1 Main St"));

    const { job } = createJob("execute-import", { companyId: company.id, importSessionId: importSession.id });
    await csvImportProcessor.handleExecuteImport(job);

    const stored = fakeDb.getTestState().importSessions.find((row) => row.id === importSession.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.errorMessage).toContain("UNSUPPORTED_ENTITY_TYPE");
    expect(fakeDb.getTestState().customers.filter((row) => row.companyId === company.id)).toHaveLength(0);
  });

  it("execute-import leaves assets with an equipment chunk plan to the equipment chunks", async () => {
    const company = fakeDb.seedCompany({ name: "Asset Co", slug: "asset-co" });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      entityType: "assets" as never,
      fileName: "assets.csv",
      fileUrl: "imports/company/assets.csv",
      status: "importing",
      columnMappings: { Serial: "serialNumber" },
      aiInferences: { equipmentChunkPlan: { chunksTotal: 1 } }
    });

    const { job } = createJob("execute-import", { companyId: company.id, importSessionId: importSession.id });
    await csvImportProcessor.handleExecuteImport(job);

    const stored = fakeDb.getTestState().importSessions.find((row) => row.id === importSession.id);
    expect(stored?.status).toBe("importing");
    expect(downloadFileMock).not.toHaveBeenCalled();
  });

  it("execute-import inserts valid rows with importSessionId, skips duplicates and errors, and enqueues dormant scan", async () => {
    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac"
    });
    fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Existing",
      lastName: "Customer",
      email: "duplicate@example.com"
    });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "imports/company/customers.csv",
      status: "importing",
      columnMappings: {
        "First Name": "firstName",
        "Last Name": "lastName",
        Email: "email",
        Phone: "phone",
        Address: "addressLine1",
        City: "city",
        State: "state",
        Zip: "zip"
      },
      validationErrors: [
        {
          row: 4,
          field: "firstName",
          message: "Required field missing",
          value: ""
        }
      ]
    });
    downloadFileMock.mockResolvedValue(
      Buffer.from(
        [
          "First Name,Last Name,Email,Phone,Address,City,State,Zip",
          "Chris,Pine,chris@example.com,5551112222,101 Main St,Tulsa,OK,74103",
          "Taylor,River,duplicate@example.com,5553334444,202 Oak Ave,Tulsa,OK,74104",
          ",,broken@example.com,5555556666,303 Pine St,Tulsa,OK,74105"
        ].join("\n")
      )
    );

    const { job, updateProgress } = createJob("execute-import", {
      companyId: company.id,
      importSessionId: importSession.id
    });

    await csvImportProcessor.handleExecuteImport(job);

    const storedSession = fakeDb.getTestState().importSessions.find((row) => row.id === importSession.id);
    const importedCustomers = fakeDb.getTestState().customers.filter((row) => row.importSessionId === importSession.id);
    const importedProperties = fakeDb.getTestState().properties.filter((row) => row.importSessionId === importSession.id);

    expect(storedSession?.status).toBe("completed");
    expect(storedSession?.importedRows).toBe(1);
    expect(storedSession?.skippedRows).toBe(2);
    expect(storedSession?.duplicateRows).toBe(1);
    expect(importedCustomers).toHaveLength(1);
    expect(importedCustomers[0]?.email).toBe("chris@example.com");
    expect(importedProperties).toHaveLength(1);
    expect(importedProperties[0]?.addressLine1).toBe("101 Main St");
    expect(addAiQueueJob).toHaveBeenCalledWith(
      "dormant-customer-scan",
      {
        companyId: company.id,
        triggeredBy: "import"
      },
      expect.objectContaining({
        delay: 5000
      })
    );
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("import.completed");
    expect(updateProgress).toHaveBeenLastCalledWith(100);
  });

  it("execute-import transitions the session to failed on unrecoverable errors", async () => {
    const company = fakeDb.seedCompany({
      name: "Acme HVAC",
      slug: "acme-hvac"
    });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "imports/company/customers.csv",
      status: "importing",
      columnMappings: {
        "First Name": "firstName"
      }
    });
    downloadFileMock.mockRejectedValue(new Error("R2 unavailable"));

    const { job } = createJob("execute-import", {
      companyId: company.id,
      importSessionId: importSession.id
    });

    await expect(csvImportProcessor.handleExecuteImport(job)).rejects.toThrow("R2 unavailable");

    const storedSession = fakeDb.getTestState().importSessions.find((row) => row.id === importSession.id);
    expect(storedSession?.status).toBe("failed");
    expect(storedSession?.errorMessage).toBe("R2 unavailable");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("import.failed");
  });
});
