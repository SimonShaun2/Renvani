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
