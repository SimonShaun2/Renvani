import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadFileMock, updateMock } = vi.hoisted(() => ({
  uploadFileMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@fsm/config/storage", () => ({ uploadFile: uploadFileMock }));
vi.mock("@fsm/db", () => {
  const chain = { set: () => chain, where: () => chain, returning: async () => [] };
  return {
    db: { update: (...args: unknown[]) => { updateMock(...args); return chain; } },
    importSessions: {},
  };
});
vi.mock("drizzle-orm", () => ({ and: () => ({}), eq: () => ({}), isNull: () => ({}) }));

import { persistImportSessionReconciliationReportBestEffort } from "./persist-import-session-reconciliation.js";

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function completedSession() {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    companyId,
    entityType: "customers",
    fileName: "customers.csv",
    status: "completed",
    totalRows: 2,
    importedRows: 1,
    skippedRows: 1,
    duplicateRows: 0,
    errorRows: 1,
    validationErrors: [],
    progress: null,
    aiInferences: {},
  } as unknown as Parameters<typeof persistImportSessionReconciliationReportBestEffort>[1];
}

const validationErrors = [{ row: 2, field: "email", message: "Invalid email", value: "x" }];

describe("persistImportSessionReconciliationReportBestEffort", () => {
  beforeEach(() => {
    uploadFileMock.mockReset();
    updateMock.mockReset();
  });

  it("swallows a skipped-rows CSV upload failure instead of failing the import", async () => {
    uploadFileMock.mockRejectedValueOnce(new Error("S3 unavailable"));

    await expect(
      persistImportSessionReconciliationReportBestEffort(companyId, completedSession(), validationErrors),
    ).resolves.toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("persists the report when storage succeeds", async () => {
    uploadFileMock.mockResolvedValueOnce(undefined);

    await expect(
      persistImportSessionReconciliationReportBestEffort(companyId, completedSession(), validationErrors),
    ).resolves.toBe(true);
    expect(uploadFileMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^imports/${companyId}/`)),
      expect.any(Buffer),
      "text/csv",
    );
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
