import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const { addImportsQueueJob, uploadCsvToR2Mock } = vi.hoisted(() => ({
  addImportsQueueJob: vi.fn(),
  uploadCsvToR2Mock: vi.fn()
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  importsQueue: {
    add: addImportsQueueJob
  }
}));

vi.mock("./file-upload.service.js", () => ({
  uploadCsvToR2: uploadCsvToR2Mock
}));

type ImportServiceModule = typeof import("./import.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let importService: ImportServiceModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  importService = await import("./import.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  addImportsQueueJob.mockReset();
  uploadCsvToR2Mock.mockReset();
  uploadCsvToR2Mock.mockResolvedValue({
    fileUrl: "https://r2.test/fsm-bucket/imports/company-1/customers.csv",
    fileKey: "imports/company-1/customers.csv"
  });
});

function createAuthContext() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac"
  });
  const actor = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@example.com",
    firstName: "Ava",
    lastName: "Stone",
    role: "owner"
  });

  return { company, actor };
}

describe("import.service", () => {
  it("FS-11-AC-07 createImportSession rejects CSV larger than 10MB", async () => {
    const actualUpload = await vi.importActual<typeof import("./file-upload.service.js")>(
      "./file-upload.service.js"
    );
    uploadCsvToR2Mock.mockImplementation(actualUpload.uploadCsvToR2);

    const { company, actor } = createAuthContext();
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0x61);

    await expect(
      importService.createImportSession(company.id, actor.id, "huge.csv", oversized, {
        mimeType: "text/csv"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR
    });
    expect(addImportsQueueJob).not.toHaveBeenCalled();
  });

  it("createImportSession uploads the file, creates a session, and enqueues AI mapping", async () => {
    const { company, actor } = createAuthContext();

    const importSession = await importService.createImportSession(
      company.id,
      actor.id,
      "customers.csv",
      Buffer.from("First Name,Email\nChris,chris@example.com"),
      {
        mimeType: "text/csv"
      }
    );

    expect(uploadCsvToR2Mock).toHaveBeenCalled();
    expect(addImportsQueueJob).toHaveBeenCalledWith(
      "map-csv-columns",
      {
        companyId: company.id,
        importSessionId: importSession.id,
        idempotencyKey: `${importSession.id}:map-csv-columns`,
      },
      expect.objectContaining({
        jobId: `map-csv-columns-${importSession.id}`
      })
    );
    expect(importSession.status).toBe("uploaded");
    const events = fakeDb.getTestState().activityEvents.filter((event) => event.eventType === "import.started");
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.at(-1)?.payload).toMatchObject({
      stepKind: "map-csv-columns",
      state: "scheduled",
    });
  });

  it("rollbackImport soft-deletes tagged records in a transaction", async () => {
    const { company, actor } = createAuthContext();
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      createdById: actor.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/fsm-bucket/imports/company-1/customers.csv",
      status: "completed"
    });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Chris",
      lastName: "Pine",
      importSessionId: importSession.id
    });
    const property = fakeDb.seedProperty({
      companyId: company.id,
      customerId: customer.id,
      addressLine1: "101 Main St",
      city: "Tulsa",
      state: "OK",
      zip: "74103",
      importSessionId: importSession.id
    });
    const asset = fakeDb.seedAsset({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      name: "Main HVAC",
      assetType: "hvac",
      importSessionId: importSession.id
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      assetId: asset.id,
      importSessionId: importSession.id
    });

    const rolledBackSession = await importService.rollbackImport(company.id, actor.id, importSession.id);

    expect(rolledBackSession.status).toBe("rolled_back");
    expect(fakeDb.getTestState().customers.find((row) => row.id === customer.id)?.deletedAt).not.toBeNull();
    expect(fakeDb.getTestState().properties.find((row) => row.id === property.id)?.deletedAt).not.toBeNull();
    expect(fakeDb.getTestState().assets.find((row) => row.id === asset.id)?.deletedAt).not.toBeNull();
    expect(fakeDb.getTestState().jobs.find((row) => row.id === job.id)?.deletedAt).not.toBeNull();
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("import.rolled_back");
  });

  it("rollbackImport restores update_existing customer snapshots before deleting tagged rows", async () => {
    const { company, actor } = createAuthContext();
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      createdById: actor.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/fsm-bucket/imports/company-1/customers.csv",
      status: "completed",
      aiInferences: {
        rollbackSnapshots: {
          customerUpdates: [
            {
              customerId: "cust-updated-1",
              before: {
                firstName: "Original",
                lastName: "Name",
                displayName: null,
                email: "orig@example.com",
                phone: null,
                altPhone: null,
                tags: ["vip"],
                internalNotes: "keep me"
              },
              propertyIds: ["prop-new-1"]
            }
          ]
        }
      }
    });
    const updatedCustomer = fakeDb.seedCustomer({
      id: "cust-updated-1",
      companyId: company.id,
      firstName: "Imported",
      lastName: "Overwrite",
      email: "new@example.com",
      importSessionId: importSession.id
    });
    fakeDb.seedProperty({
      id: "prop-new-1",
      companyId: company.id,
      customerId: updatedCustomer.id,
      addressLine1: "9 New St",
      city: "Tulsa",
      state: "OK",
      zip: "74103",
      importSessionId: importSession.id
    });
    const insertedCustomer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Brand",
      lastName: "New",
      importSessionId: importSession.id
    });

    await importService.rollbackImport(company.id, actor.id, importSession.id);

    const restored = fakeDb.getTestState().customers.find((row) => row.id === updatedCustomer.id);
    expect(restored?.firstName).toBe("Original");
    expect(restored?.email).toBe("orig@example.com");
    expect(restored?.importSessionId).toBeNull();
    expect(restored?.deletedAt).toBeNull();
    expect(
      fakeDb.getTestState().properties.find((row) => row.id === "prop-new-1")?.deletedAt
    ).not.toBeNull();
    expect(
      fakeDb.getTestState().customers.find((row) => row.id === insertedCustomer.id)?.deletedAt
    ).not.toBeNull();
  });

  it("rollbackImport deletes draft and voids sent imported invoices, deletes draft and expires sent estimates", async () => {
    const { company, actor } = createAuthContext();
    const importSession = fakeDb.seedImportSession({
      companyId: company.id, createdById: actor.id, fileName: "invoices.csv",
      fileUrl: "https://r2.test/fsm-bucket/imports/company-1/invoices.csv", status: "completed"
    });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B" });
    const tag = { companyId: company.id, customerId: customer.id, importSessionId: importSession.id };
    const draftInvoice = fakeDb.seedInvoice({ ...tag, status: "draft" } as never);
    const sentInvoice = fakeDb.seedInvoice({ ...tag, status: "sent", balanceDue: "40.00" } as never);
    const draftEstimate = fakeDb.seedEstimate({ ...tag, status: "draft" } as never);
    const sentEstimate = fakeDb.seedEstimate({ ...tag, status: "sent" } as never);

    await importService.rollbackImport(company.id, actor.id, importSession.id);

    const state = fakeDb.getTestState();
    expect(state.invoices.find((row) => row.id === draftInvoice.id)?.deletedAt).not.toBeNull();
    expect(state.invoices.find((row) => row.id === sentInvoice.id)).toMatchObject({ status: "void", deletedAt: null });
    expect(state.estimates.find((row) => row.id === draftEstimate.id)?.deletedAt).not.toBeNull();
    expect(state.estimates.find((row) => row.id === sentEstimate.id)?.status).toBe("expired");
  });

  it("rollbackImport refuses with counts and ids when imported billing has payments or accepted estimates", async () => {
    const { company, actor } = createAuthContext();
    const importSession = fakeDb.seedImportSession({
      companyId: company.id, createdById: actor.id, fileName: "invoices.csv",
      fileUrl: "https://r2.test/fsm-bucket/imports/company-1/invoices.csv", status: "completed"
    });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B", importSessionId: importSession.id });
    const tag = { companyId: company.id, customerId: customer.id, importSessionId: importSession.id };
    const paidInvoice = fakeDb.seedInvoice({ ...tag, status: "sent" } as never);
    const payment = fakeDb.seedPayment({ companyId: company.id, invoiceId: paidInvoice.id, customerId: customer.id, amount: "10.00" });
    const approved = fakeDb.seedEstimate({ ...tag, status: "approved" } as never);

    const error = await importService.rollbackImport(company.id, actor.id, importSession.id).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: ErrorCode.CONFLICT,
      fields: { invoiceIds: paidInvoice.id, estimateIds: approved.id }
    });
    expect((error as Error).message).toContain("1 invoice(s)");
    const state = fakeDb.getTestState();
    expect(state.invoices.find((row) => row.id === paidInvoice.id)?.status).toBe("sent");
    expect(state.payments.find((row) => row.id === payment.id)).toBeDefined();
    expect(state.customers.find((row) => row.id === customer.id)?.deletedAt ?? null).toBeNull();
    expect(state.importSessions.find((row) => row.id === importSession.id)?.status).toBe("completed");
  });

  it("rollbackImport throws CONFLICT when the session is not completed", async () => {
    const { company, actor } = createAuthContext();
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      createdById: actor.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/fsm-bucket/imports/company-1/customers.csv",
      status: "preview"
    });

    await expect(
      importService.rollbackImport(company.id, actor.id, importSession.id)
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });
});
