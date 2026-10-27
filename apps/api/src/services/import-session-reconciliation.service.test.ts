import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectResult, createSignedDownloadUrl } = vi.hoisted(() => ({
  selectResult: { rows: [] as unknown[] },
  createSignedDownloadUrl: vi.fn(async (key: string) => ({ url: `https://signed/${key}` }))
}));

vi.mock("@fsm/config/storage", () => ({ createSignedDownloadUrl }));
vi.mock("@fsm/db", () => {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: async () => selectResult.rows
  };
  return { db: { select: () => chain }, importSessions: {} };
});
vi.mock("drizzle-orm", () => ({ and: () => ({}), eq: () => ({}), isNull: () => ({}) }));
vi.mock("../lib/import-reconciliation.js", () => ({
  readImportReconciliationReportFromAiInferences: (value: unknown) =>
    (value as { report?: unknown } | null)?.report ?? null
}));

import {
  getImportSessionReconciliation,
  isTenantImportObjectKey
} from "./import-session-reconciliation.service.js";

const COMPANY = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function sessionWithKey(key: string | null) {
  return { id: "s1", aiInferences: { report: { skippedRowsCsvObjectKey: key } } };
}

describe("isTenantImportObjectKey", () => {
  it("accepts keys under imports/{companyId}/", () => {
    expect(isTenantImportObjectKey(COMPANY, `imports/${COMPANY}/s1/skipped-rows.csv`)).toBe(true);
  });

  it("rejects other tenants, traversal, and bare prefixes", () => {
    expect(isTenantImportObjectKey(COMPANY, `imports/${OTHER}/s1/skipped-rows.csv`)).toBe(false);
    expect(isTenantImportObjectKey(COMPANY, `imports/${COMPANY}/../${OTHER}/x.csv`)).toBe(false);
    expect(isTenantImportObjectKey(COMPANY, `imports/${COMPANY}/`)).toBe(false);
    expect(isTenantImportObjectKey(COMPANY, `other/${COMPANY}/x.csv`)).toBe(false);
    expect(isTenantImportObjectKey("", `imports//x.csv`)).toBe(false);
  });
});

describe("getImportSessionReconciliation signed URL", () => {
  beforeEach(() => {
    createSignedDownloadUrl.mockClear();
  });

  it("signs a tenant-scoped key", async () => {
    selectResult.rows = [sessionWithKey(`imports/${COMPANY}/s1/skipped-rows.csv`)];
    const result = await getImportSessionReconciliation(COMPANY, "s1");
    expect(createSignedDownloadUrl).toHaveBeenCalledTimes(1);
    expect(result.skippedRowsDownloadUrl).toContain(COMPANY);
  });

  it("fails closed for a cross-tenant key", async () => {
    selectResult.rows = [sessionWithKey(`imports/${OTHER}/s1/skipped-rows.csv`)];
    const result = await getImportSessionReconciliation(COMPANY, "s1");
    expect(createSignedDownloadUrl).not.toHaveBeenCalled();
    expect(result.skippedRowsDownloadUrl).toBeNull();
  });
});
