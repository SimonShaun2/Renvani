import type { Job } from "bullmq";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildImportChunkIdempotencyKey } from "@fsm/jobs";

import { setupTestEnv } from "../../../api/src/test-support/env-setup.js";

setupTestEnv();

const { downloadFileMock, commitImportedEquipmentRowsMock, commitImportedInvoiceRowsMock, tenantSessionCalls } =
  vi.hoisted(() => ({
    downloadFileMock: vi.fn(),
    commitImportedEquipmentRowsMock: vi.fn(),
    commitImportedInvoiceRowsMock: vi.fn(),
    tenantSessionCalls: [] as string[],
  }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../../api/src/test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../../api/src/test-support/fake-db.js");
  const base = helper.createDbModuleMock();
  return {
    ...base,
    runTransactionWithTenantSession: async <T>(companyId: string, callback: (tx: unknown) => Promise<T>) => {
      tenantSessionCalls.push(companyId);
      return base.runTransactionWithTenantSession(companyId, callback as never) as Promise<T>;
    },
    commitImportedEquipmentRows: commitImportedEquipmentRowsMock,
    commitImportedInvoiceRows: commitImportedInvoiceRowsMock,
    // DB-backed lineage resolvers: only raw ids (or nothing) here; scoping is what's under test.
    createDbHistoryChunkResolver: async () => ({
      resolveCustomerId: async ({ customerId }: { customerId?: string }) => customerId ?? null,
      resolveJobId: async () => null,
    }),
    buildLineageEquipmentResolver: async () => ({
      resolveCustomerId: async ({ customerId }: { customerId?: string }) => customerId ?? null,
      resolvePropertyId: async ({ propertyId }: { propertyId?: string }) => propertyId ?? null,
    }),
  };
});

vi.mock("../lib/persist-import-session-reconciliation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/persist-import-session-reconciliation.js")>();
  return { ...actual, persistImportSessionReconciliationReportBestEffort: vi.fn(async () => true) };
});

vi.mock("@fsm/config/storage", () => ({
  downloadFile: downloadFileMock,
  getFileKeyFromUrl: (fileUrl: string) => fileUrl,
}));

type ProcessorModule = typeof import("./import-chunk-commit.processor.js");
type RegistryModule = typeof import("../lib/import-chunk-committer.registry.js");
type BuiltinsModule = typeof import("../lib/import-chunk-builtin-committers.js");
type FakeDbModule = typeof import("../../../api/src/test-support/fake-db.js");

let processor: ProcessorModule;
let registry: RegistryModule;
let builtins: BuiltinsModule;
let fakeDb: FakeDbModule;

const companyA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const customerA = "11111111-1111-4111-8111-111111111111";
const customerB = "22222222-2222-4222-8222-222222222222";
const propertyA = "33333333-3333-4333-8333-333333333333";
const propertyB = "44444444-4444-4444-8444-444444444444";

beforeAll(async () => {
  processor = await import("./import-chunk-commit.processor.js");
  registry = await import("../lib/import-chunk-committer.registry.js");
  builtins = await import("../lib/import-chunk-builtin-committers.js");
  fakeDb = await import("../../../api/src/test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  downloadFileMock.mockReset();
  commitImportedEquipmentRowsMock.mockReset();
  commitImportedInvoiceRowsMock.mockReset();
  tenantSessionCalls.length = 0;
  builtins.registerBuiltinImportChunkCommitters({ override: true });
  fakeDb.seedCustomer({ id: customerA, companyId: companyA, firstName: "Ada", lastName: "A" });
  fakeDb.seedCustomer({ id: customerB, companyId: companyB, firstName: "Bea", lastName: "B" });
});

function csv(lines: string[]) {
  return Buffer.from(lines.join("\n"), "utf8");
}

function seedSession(entityType: string, columnMappings: Record<string, string>) {
  fakeDb.seedImportSession({
    id: sessionId,
    companyId: companyA,
    entityType: entityType as never,
    status: "importing",
    fileName: `${entityType}.csv`,
    fileUrl: `imports/${entityType}.csv`,
    columnMappings,
  });
}

function payload(entityType: string, chunkIndex = 0) {
  return {
    companyId: companyA,
    importSessionId: sessionId,
    sourceSystem: "jobber",
    entityType,
    chunkIndex,
    chunksTotal: 1,
    cursor: { rowOffset: 0 },
    idempotencyKey: buildImportChunkIdempotencyKey(sessionId, entityType as never, chunkIndex),
  };
}

function job(data: Record<string, unknown>) {
  return {
    id: "job-1",
    name: "import-chunk-commit",
    data,
    updateProgress: vi.fn(async () => undefined),
  } as unknown as Job<Record<string, unknown>>;
}

/** Re-queues a chunk as if the previous attempt crashed after committing rows. */
function resetChunkRunToFailed() {
  for (const run of fakeDb.getTestState().importChunkRuns) {
    run.status = "failed";
  }
}

const propertyMapping = {
  loc_id: "sourceId",
  customer_id: "customerId",
  street: "addressLine1",
  city: "city",
  state: "state",
  zip: "zip",
  kind: "type",
};

describe("import-chunk-commit built-in committers", () => {
  it("registers built-in committers for every chunk entity type", () => {
    for (const entityType of ["customers", "properties", "assets", "jobs", "estimates", "invoices"]) {
      expect(registry.hasImportChunkCommitter(entityType)).toBe(true);
    }
  });

  describe("properties", () => {
    beforeEach(() => {
      seedSession("properties", propertyMapping);
      downloadFileMock.mockResolvedValue(
        csv([
          "loc_id,customer_id,street,city,state,zip,kind",
          `loc-1,${customerA},1 Main St,Chicago,IL,60601,Commercial`,
          `loc-2,${customerA},,Chicago,IL,60601,residential`,
        ]),
      );
    });

    it("commits rows under the tenant session and counts invalid rows as failed", async () => {
      await processor.handleImportChunkCommit(job(payload("properties")));

      const state = fakeDb.getTestState();
      const imported = state.properties.filter((p) => p.sourceId === "loc-1");
      expect(imported).toHaveLength(1);
      expect(imported[0]).toMatchObject({
        companyId: companyA,
        customerId: customerA,
        type: "commercial",
        sourceSystem: "jobber",
        importSessionId: sessionId,
      });
      expect(state.importChunkRuns[0]).toMatchObject({ status: "completed", rowsOk: 1, rowsFailed: 1 });
      expect(tenantSessionCalls).toEqual([companyA]);
    });

    it("is idempotent per row when a chunk is re-run", async () => {
      await processor.handleImportChunkCommit(job(payload("properties")));
      resetChunkRunToFailed();
      await processor.handleImportChunkCommit(job(payload("properties")));

      expect(fakeDb.getTestState().properties.filter((p) => p.sourceId === "loc-1")).toHaveLength(1);
    });

    it("cannot attach a property to another company's customer", async () => {
      downloadFileMock.mockResolvedValue(
        csv(["loc_id,customer_id,street,city,state,zip,kind", `loc-x,${customerB},9 Other St,Austin,TX,73301,`]),
      );

      await processor.handleImportChunkCommit(job(payload("properties")));

      const state = fakeDb.getTestState();
      expect(state.properties.filter((p) => p.sourceId === "loc-x")).toHaveLength(0);
      expect(state.importChunkRuns[0]).toMatchObject({ status: "completed", rowsOk: 0, rowsFailed: 1 });
    });

    it("does not update another company's property with the same lineage", async () => {
      fakeDb.seedProperty({
        id: propertyB,
        companyId: companyB,
        customerId: customerB,
        addressLine1: "B street",
        city: "Austin",
        state: "TX",
        zip: "73301",
        sourceSystem: "jobber",
        sourceId: "loc-1",
      });

      await processor.handleImportChunkCommit(job(payload("properties")));

      const state = fakeDb.getTestState();
      const companyBRow = state.properties.find((p) => p.id === propertyB);
      expect(companyBRow?.addressLine1).toBe("B street");
      expect(state.properties.filter((p) => p.sourceId === "loc-1" && p.companyId === companyA)).toHaveLength(1);
    });
  });

  describe("assets (wraps commitImportedEquipmentRows)", () => {
    beforeEach(() => {
      seedSession("assets", {
        equipment_id: "sourceId",
        name: "name",
        customer_id: "customerId",
        property_id: "propertyId",
      });
      fakeDb.seedProperty({
        id: propertyA,
        companyId: companyA,
        customerId: customerA,
        addressLine1: "1 Main St",
        city: "Chicago",
        state: "IL",
        zip: "60601",
      });
      downloadFileMock.mockResolvedValue(
        csv(["equipment_id,name,customer_id,property_id", `eq-1,Furnace,${customerA},${propertyA}`]),
      );
      commitImportedEquipmentRowsMock.mockResolvedValue({ assetsCommitted: 1, rowsFailed: 0, errors: [] });
    });

    it("maps rows, passes the tenant tx, and records the chunk result", async () => {
      await processor.handleImportChunkCommit(job(payload("assets")));

      expect(commitImportedEquipmentRowsMock).toHaveBeenCalledTimes(1);
      const [ctx, rows, , executor] = commitImportedEquipmentRowsMock.mock.calls[0]!;
      expect(ctx).toEqual({ companyId: companyA, importSessionId: sessionId, sourceSystem: "jobber" });
      expect(rows[0]).toMatchObject({ sourceId: "eq-1", name: "Furnace", customerId: customerA });
      expect(executor).toBeDefined();
      expect(tenantSessionCalls).toEqual([companyA]);
      expect(fakeDb.getTestState().importChunkRuns[0]).toMatchObject({ status: "completed", rowsOk: 1 });
    });

    it("skips an already-completed chunk on re-queue (no second commit)", async () => {
      await processor.handleImportChunkCommit(job(payload("assets")));
      await processor.handleImportChunkCommit(job(payload("assets")));
      expect(commitImportedEquipmentRowsMock).toHaveBeenCalledTimes(1);
    });

    it("scopes resolver lookups to the importing company", async () => {
      await processor.handleImportChunkCommit(job(payload("assets")));
      const resolver = commitImportedEquipmentRowsMock.mock.calls[0]![2];

      expect(await resolver.resolveCustomerId({ customerId: customerA })).toBe(customerA);
      expect(await resolver.resolveCustomerId({ customerId: customerB })).toBeNull();
      expect(await resolver.resolveCustomerId({ customerId: "not-a-uuid" })).toBeNull();
      expect(await resolver.resolvePropertyId({ customerId: customerA, propertyId: propertyA })).toBe(propertyA);
      expect(await resolver.resolvePropertyId({ customerId: customerA, propertyId: propertyB })).toBeNull();
    });
  });

  describe("invoices (wraps commitImportedInvoiceRows)", () => {
    beforeEach(() => {
      seedSession("invoices", {
        inv_id: "sourceId",
        number: "invoiceNumber",
        customer_id: "customerId",
        total: "total",
      });
      downloadFileMock.mockResolvedValue(csv(["inv_id,number,customer_id,total", `inv-1,1001,${customerA},125.50`]));
      commitImportedInvoiceRowsMock.mockResolvedValue({ invoicesCommitted: 1, rowsFailed: 0, errors: [] });
    });

    it("maps rows, passes the tenant tx, and records the chunk result", async () => {
      await processor.handleImportChunkCommit(job(payload("invoices")));

      const [ctx, rows, resolver, executor] = commitImportedInvoiceRowsMock.mock.calls[0]!;
      expect(ctx.companyId).toBe(companyA);
      expect(rows[0]).toMatchObject({ sourceId: "inv-1", invoiceNumber: "1001" });
      expect(executor).toBeDefined();
      expect(await resolver.resolveCustomerId({ customerId: customerB })).toBeNull();
      expect(await resolver.resolveCustomerId({ customerId: customerA })).toBe(customerA);
      expect(fakeDb.getTestState().importChunkRuns[0]).toMatchObject({ status: "completed", rowsOk: 1 });
    });

    it("reads QuickBooks IIF TRNS records for an invoices session", async () => {
      fakeDb.getTestState().importSessions.length = 0;
      fakeDb.seedImportSession({
        id: sessionId,
        companyId: companyA,
        entityType: "invoices" as never,
        status: "importing",
        fileName: "qb.iif",
        fileUrl: "imports/qb.iif",
        columnMappings: { DOCNUM: "invoiceNumber", NAME: "customerSourceId", AMOUNT: "total" },
      } as never);
      downloadFileMock.mockResolvedValue(
        Buffer.from(
          ["!CUST\tNAME", "CUST\tAcme Co", "!TRNS\tTRNSTYPE\tDOCNUM\tNAME\tAMOUNT", "TRNS\tINVOICE\t5001\tAcme Co\t99.00"].join("\n"),
          "utf8",
        ),
      );

      await processor.handleImportChunkCommit(job(payload("invoices")));

      const rows = commitImportedInvoiceRowsMock.mock.calls[0]![1];
      expect(rows[0]).toMatchObject({ invoiceNumber: "5001", customerSourceId: "Acme Co" });
    });

    it("re-runs a failed chunk through the same lineage-keyed commit", async () => {
      await processor.handleImportChunkCommit(job(payload("invoices")));
      resetChunkRunToFailed();
      await processor.handleImportChunkCommit(job(payload("invoices")));

      expect(commitImportedInvoiceRowsMock).toHaveBeenCalledTimes(2);
      const firstRows = commitImportedInvoiceRowsMock.mock.calls[0]![1];
      const secondRows = commitImportedInvoiceRowsMock.mock.calls[1]![1];
      expect(secondRows.map((r: { sourceId: string }) => r.sourceId)).toEqual(
        firstRows.map((r: { sourceId: string }) => r.sourceId),
      );
    });
  });

  describe("customers (shared dedupe + duplicate choices + primary property)", () => {
    const customerMapping = {
      ext_id: "sourceId",
      first: "firstName",
      last: "lastName",
      email: "email",
      phone: "phone",
      street: "addressLine1",
      city: "city",
      state: "state",
      zip: "zip",
    };
    const header = "ext_id,first,last,email,phone,street,city,state,zip";

    function seedCustomerSession(extra: Record<string, unknown> = {}, fileName = "customers.csv") {
      fakeDb.seedImportSession({
        id: sessionId,
        companyId: companyA,
        entityType: "customers" as never,
        status: "importing",
        fileName,
        fileUrl: `imports/${fileName}`,
        columnMappings: customerMapping,
        ...extra,
      } as never);
    }

    function companyACustomers() {
      return fakeDb.getTestState().customers.filter((c) => c.companyId === companyA);
    }

    it("inserts new customers with lineage and upserts a primary property from mapped address", async () => {
      seedCustomerSession();
      downloadFileMock.mockResolvedValue(
        csv([header, "c-1,Cal,Cruz,cal@example.com,3125550101,1 Main St,Chicago,IL,60601", "c-2,Dee,Dunn,,,,,,"]),
      );

      await processor.handleImportChunkCommit(job(payload("customers")));

      const cal = companyACustomers().find((c) => c.sourceId === "c-1");
      expect(cal).toMatchObject({ firstName: "Cal", sourceSystem: "jobber", importSessionId: sessionId });
      const props = fakeDb.getTestState().properties.filter((p) => p.customerId === cal?.id);
      expect(props).toHaveLength(1);
      expect(props[0]).toMatchObject({
        companyId: companyA,
        addressLine1: "1 Main St",
        isPrimary: true,
        sourceId: "customer:c-1",
      });
      expect(companyACustomers().find((c) => c.sourceId === "c-2")).toBeDefined();
      expect(fakeDb.getTestState().properties.filter((p) => p.sourceId === "customer:c-2")).toHaveLength(0);
      expect(fakeDb.getTestState().importChunkRuns[0]).toMatchObject({ status: "completed", rowsOk: 2, rowsFailed: 0 });
      expect(tenantSessionCalls).toEqual([companyA]);
    });

    it("is idempotent on (companyId, sourceSystem, sourceId) when a chunk is re-run", async () => {
      seedCustomerSession();
      downloadFileMock.mockResolvedValue(csv([header, "c-1,Cal,Cruz,cal@example.com,,1 Main St,Chicago,IL,60601"]));

      await processor.handleImportChunkCommit(job(payload("customers")));
      resetChunkRunToFailed();
      await processor.handleImportChunkCommit(job(payload("customers")));

      expect(companyACustomers().filter((c) => c.sourceId === "c-1")).toHaveLength(1);
      expect(fakeDb.getTestState().properties.filter((p) => p.sourceId === "customer:c-1")).toHaveLength(1);
    });

    it("skips an email/phone duplicate of an existing customer by default", async () => {
      fakeDb.seedCustomer({ companyId: companyA, firstName: "Old", lastName: "Email", email: "dup@example.com" });
      fakeDb.seedCustomer({ companyId: companyA, firstName: "Old", lastName: "Phone", phone: "+13125550199" });
      seedCustomerSession();
      downloadFileMock.mockResolvedValue(
        csv([header, "c-1,New,Email,DUP@example.com,,,,,", "c-2,New,Phone,,(312) 555-0199,,,,"]),
      );

      await processor.handleImportChunkCommit(job(payload("customers")));

      expect(companyACustomers().filter((c) => c.sourceId)).toHaveLength(0);
      expect(companyACustomers()).toHaveLength(3);
      expect(fakeDb.getTestState().importChunkRuns[0]).toMatchObject({ rowsOk: 0, rowsFailed: 0 });
      expect(fakeDb.getTestState().importSessions[0]?.skippedRows).toBe(2);
    });

    it("honors the user's duplicate choices (update_existing / import_new)", async () => {
      const existing = fakeDb.seedCustomer({
        companyId: companyA,
        firstName: "Old",
        lastName: "Name",
        email: "dup@example.com",
        phone: null,
      } as never);
      seedCustomerSession({ aiInferences: { duplicateActions: { "2": "update_existing", "3": "import_new" } } });
      downloadFileMock.mockResolvedValue(
        csv([header, "c-1,Upd,Ated,dup@example.com,3125550142,,,,", "c-2,Brand,New,dup@example.com,,,,,"]),
      );

      await processor.handleImportChunkCommit(job(payload("customers")));

      const updated = companyACustomers().find((c) => c.id === existing.id);
      // Same fill-blanks merge as execute-import: existing names kept, empty phone filled.
      expect(updated).toMatchObject({ firstName: "Old", sourceId: "c-1", sourceSystem: "jobber" });
      expect(updated?.phone).toBeTruthy();
      expect(companyACustomers().filter((c) => c.email === "dup@example.com")).toHaveLength(2);
      expect(companyACustomers().find((c) => c.sourceId === "c-2")?.firstName).toBe("Brand");
      expect(fakeDb.getTestState().importChunkRuns[0]).toMatchObject({ rowsOk: 2 });
    });

    it("does not write rows that failed validation", async () => {
      seedCustomerSession({ validationErrors: [{ row: 2, field: "email", message: "Invalid email", value: "x" }] });
      downloadFileMock.mockResolvedValue(csv([header, "c-1,Bad,Email,x,,,,,", "c-2,Good,Row,,,,,,"]));

      await processor.handleImportChunkCommit(job(payload("customers")));

      expect(companyACustomers().find((c) => c.sourceId === "c-1")).toBeUndefined();
      expect(companyACustomers().find((c) => c.sourceId === "c-2")).toBeDefined();
    });

    it("never matches or updates another company's customer as a duplicate", async () => {
      fakeDb.seedCustomer({ companyId: companyB, firstName: "Other", lastName: "Tenant", email: "x@example.com" });
      seedCustomerSession({ aiInferences: { duplicateActions: { "2": "update_existing" } } });
      downloadFileMock.mockResolvedValue(csv([header, "c-1,Mine,Row,x@example.com,,,,,"]));

      await processor.handleImportChunkCommit(job(payload("customers")));

      expect(fakeDb.getTestState().customers.find((c) => c.companyId === companyB && c.email === "x@example.com"))
        .toMatchObject({ firstName: "Other", sourceId: null });
      expect(companyACustomers().find((c) => c.sourceId === "c-1")?.firstName).toBe("Mine");
    });

    it("commits QuickBooks IIF CUST records through the same customer path", async () => {
      fakeDb.seedImportSession({
        id: sessionId,
        companyId: companyA,
        entityType: "customers" as never,
        status: "importing",
        fileName: "qb-export.iif",
        fileUrl: "imports/qb-export.iif",
        columnMappings: { NAME: "sourceId", FIRSTNAME: "firstName", LASTNAME: "lastName", EMAIL: "email", PHONE1: "phone" },
      } as never);
      downloadFileMock.mockResolvedValue(
        Buffer.from(
          [
            "!CUST\tNAME\tFIRSTNAME\tLASTNAME\tEMAIL\tPHONE1",
            "CUST\tAcme Co\tAnn\tAcme\tann@acme.test\t3125550123",
            "CUST\tBeta LLC\tBo\tBeta\t\t",
          ].join("\n"),
          "utf8",
        ),
      );

      await processor.handleImportChunkCommit(job(payload("customers")));

      expect(companyACustomers().find((c) => c.sourceId === "Acme Co")).toMatchObject({
        firstName: "Ann",
        email: "ann@acme.test",
      });
      expect(companyACustomers().find((c) => c.sourceId === "Beta LLC")).toBeDefined();
      expect(fakeDb.getTestState().importChunkRuns[0]).toMatchObject({ status: "completed", rowsOk: 2 });
    });
  });

  describe("properties linked to customers by source id", () => {
    it("fails (does not insert) a property whose customer source id does not resolve in this company", async () => {
      seedSession("properties", { loc_id: "sourceId", cust: "customerSourceId", street: "addressLine1", city: "city", state: "state", zip: "zip" });
      downloadFileMock.mockResolvedValue(csv(["loc_id,cust,street,city,state,zip", "loc-9,c-ada,5 Elm St,Chicago,IL,60601"]));

      await processor.handleImportChunkCommit(job(payload("properties")));

      // Resolver mock only resolves raw customer ids, so an unresolved source id is a failed row, not a stray insert.
      expect(fakeDb.getTestState().properties.filter((p) => p.sourceId === "loc-9")).toHaveLength(0);
      expect(fakeDb.getTestState().importChunkRuns[0]).toMatchObject({ rowsOk: 0, rowsFailed: 1 });
    });
  });

  describe("unregistered entity types", () => {
    it("marks the chunk failed with a clear message and does not throw", async () => {
      seedSession("invoices", { inv_id: "sourceId" });
      downloadFileMock.mockResolvedValue(csv(["inv_id", "inv-1"]));
      registry.unregisterImportChunkCommitter("invoices");

      await expect(processor.handleImportChunkCommit(job(payload("invoices")))).resolves.toBeUndefined();

      const run = fakeDb.getTestState().importChunkRuns[0];
      expect(run?.status).toBe("failed");
      expect(run?.errorMessage).toContain('No import chunk committer registered for entity type "invoices"');
      expect(commitImportedInvoiceRowsMock).not.toHaveBeenCalled();
    });

    it("uses an add-on committer registered for a type", async () => {
      seedSession("invoices", { inv_id: "sourceId" });
      downloadFileMock.mockResolvedValue(csv(["inv_id", "inv-1", "inv-2"]));
      const addon = vi.fn(async () => ({ rowsOk: 2, rowsFailed: 0 }));
      registry.registerImportChunkCommitter("invoices", addon);

      await processor.handleImportChunkCommit(job(payload("invoices")));

      expect(addon).toHaveBeenCalledTimes(1);
      expect(commitImportedInvoiceRowsMock).not.toHaveBeenCalled();
      expect(fakeDb.getTestState().importChunkRuns[0]).toMatchObject({ status: "completed", rowsOk: 2 });
    });
  });
});
