import { beforeEach, describe, expect, it, vi } from "vitest";

const { createImportSessionMock } = vi.hoisted(() => ({ createImportSessionMock: vi.fn() }));

vi.mock("../../services/import.service.js", () => ({
  confirmMapping: vi.fn(),
  createImportSession: createImportSessionMock,
  getImportErrors: vi.fn(),
  getImportSession: vi.fn(),
  listImportSessions: vi.fn(),
  rollbackImport: vi.fn(),
  startImport: vi.fn()
}));
vi.mock("../../services/import-session-ingest-status.service.js", () => ({ getImportSessionIngestStatus: vi.fn() }));
vi.mock("../../services/import-ingest-progress.service.js", () => ({ getImportSessionIngestProgress: vi.fn() }));
vi.mock("../../services/import-migrate-file-batch-operator.service.js", () => ({
  getMigrateFileBatchOperatorStatus: vi.fn(),
  retryMigrateFileBatchFailedObjects: vi.fn()
}));
vi.mock("./upload-guards.js", () => ({ abortImportUploadRequest: vi.fn() }));

import { createImportHandler } from "./handlers.js";
import { UPLOADABLE_IMPORT_ENTITY_TYPES } from "./schemas.js";

function requestWith(entityType: string) {
  const parts = [
    { type: "field", fieldname: "entityType", value: entityType },
    { type: "file", fieldname: "file", filename: "rows.csv", mimetype: "text/csv", toBuffer: async () => Buffer.from("a,b\n1,2\n") }
  ];
  return {
    company: { id: "company-1" },
    user: { id: "user-1" },
    raw: { destroy: vi.fn() },
    parts: async function* () {
      yield* parts;
    }
  } as never;
}

function reply() {
  const r = { status: vi.fn(() => r), send: vi.fn(() => r) };
  return r as never;
}

const session = {
  id: "s1", fileName: "rows.csv", status: "uploaded", totalRows: 0, validRows: 0, errorRows: 0,
  duplicateRows: 0, importedRows: 0, skippedRows: 0, columnMappings: {}, aiInferences: {},
  createdAt: new Date(), updatedAt: new Date()
};

describe("createImportHandler entity types", () => {
  beforeEach(() => {
    createImportSessionMock.mockReset();
  });

  it.each(["properties", "invoices", "jobs", "price_book"])("starts a %s session (not customers)", async (type) => {
    createImportSessionMock.mockResolvedValue({ ...session, entityType: type });
    await createImportHandler(requestWith(type), reply());
    expect(createImportSessionMock.mock.calls[0]?.[4]).toMatchObject({ entityType: type });
  });

  it("rejects an unknown entity type instead of importing it as customers", async () => {
    await expect(createImportHandler(requestWith("widgets"), reply())).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(createImportSessionMock).not.toHaveBeenCalled();
  });

  it("covers every chunk-committable type plus the price book", () => {
    for (const type of ["customers", "properties", "jobs", "estimates", "invoices", "price_book"]) {
      expect(UPLOADABLE_IMPORT_ENTITY_TYPES).toContain(type);
    }
  });
});
