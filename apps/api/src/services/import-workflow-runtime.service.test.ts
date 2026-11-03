import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { IMPORT_POLICY_V1, buildImportChunkIdempotencyKey } from "@fsm/types";

const enqueueImportChunkCommitJob = vi.fn();
const addImportsQueueJob = vi.fn();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  enqueueImportChunkCommitJob,
  importsQueue: {
    add: addImportsQueueJob,
  },
}));

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

type FakeDbModule = typeof import("../test-support/fake-db.js");

let fakeDb: FakeDbModule;
let scheduleImportChunkCommitsFromSessionAiInferences: typeof import("./import-workflow-runtime.service.js").scheduleImportChunkCommitsFromSessionAiInferences;
let enqueueDurableImportChunkCommitStep: typeof import("./import-workflow-runtime.service.js").enqueueDurableImportChunkCommitStep;

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  ({ scheduleImportChunkCommitsFromSessionAiInferences, enqueueDurableImportChunkCommitStep } = await import(
    "./import-workflow-runtime.service.js"
  ));
});

describe("import workflow runtime service", () => {
  const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  beforeEach(() => {
    enqueueImportChunkCommitJob.mockReset();
    addImportsQueueJob.mockReset();
    fakeDb.resetTestState();
  });

  it("returns zero when chunk manifest is absent", async () => {
    const company = fakeDb.seedCompany({ name: "Chunk Runtime Co", slug: "chunk-runtime" });
    const session = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "importing",
      aiInferences: {},
    });

    const count = await scheduleImportChunkCommitsFromSessionAiInferences(company.id, actorId, session.id);
    expect(count).toBe(0);
    expect(enqueueImportChunkCommitJob).not.toHaveBeenCalled();
  });

  it("enqueues durable import-chunk-commit steps and emits agent-aligned audit payload", async () => {
    const company = fakeDb.seedCompany({ name: "Chunk Runtime Co 2", slug: "chunk-runtime-2" });
    const session = fakeDb.seedImportSession({
      companyId: company.id,
      entityType: "customers",
      sourceSystem: "jobber",
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "importing",
      aiInferences: {
        importChunkCommitManifest: {
          sourceSystem: "jobber",
          entityType: "customers",
          chunks: [
            {
              chunkIndex: 0,
              chunksTotal: 2,
              cursor: { rowOffset: 0 },
            },
            {
              chunkIndex: 1,
              chunksTotal: 2,
              cursor: { rowOffset: 500 },
            },
          ],
        },
      },
    });

    const count = await scheduleImportChunkCommitsFromSessionAiInferences(company.id, actorId, session.id);

    expect(count).toBe(2);
    expect(enqueueImportChunkCommitJob).toHaveBeenCalledTimes(2);

    const auditEvents = fakeDb.getTestState().activityEvents.filter((event) => event.eventType === "import.started");
    expect(auditEvents.length).toBeGreaterThanOrEqual(2);
    const lastPayload = auditEvents.at(-1)?.payload as Record<string, unknown>;
    expect(lastPayload.policyVersion).toBe(IMPORT_POLICY_V1);
    expect(lastPayload.contractVersion).toBe("1.0.0");
    expect(lastPayload.stepKind).toBe("import-chunk-commit");

    expect(fakeDb.getTestState().importChunkRuns).toHaveLength(2);
    expect(fakeDb.getTestState().importChunkRuns.every((run) => run.status === "pending")).toBe(true);
  });

  it("dedupes completed chunk runs without re-enqueueing", async () => {
    const company = fakeDb.seedCompany({ name: "Chunk Dedupe Co", slug: "chunk-dedupe" });
    const session = fakeDb.seedImportSession({
      companyId: company.id,
      entityType: "customers",
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "importing",
    });

    const idempotencyKey = buildImportChunkIdempotencyKey(session.id, "customers", 0);
    fakeDb.getTestState().importChunkRuns.push({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      companyId: company.id,
      importSessionId: session.id,
      entityType: "customers",
      chunkIndex: 0,
      chunksTotal: 1,
      idempotencyKey,
      status: "completed",
      cursor: { rowOffset: 0, payloadFingerprint: "abc" },
      rowsOk: 10,
      rowsFailed: 0,
      errorMessage: null,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const outcome = await enqueueDurableImportChunkCommitStep(company.id, actorId, {
      companyId: company.id,
      importSessionId: session.id,
      sourceSystem: "manual_csv",
      entityType: "customers",
      chunkIndex: 0,
      chunksTotal: 1,
      cursor: { rowOffset: 0 },
      idempotencyKey,
    });

    expect(outcome).toBe("deduped_completed");
    expect(enqueueImportChunkCommitJob).not.toHaveBeenCalled();
  });
});
