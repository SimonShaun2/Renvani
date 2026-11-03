import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const row = {
    jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    companyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    resourceVersion: "2026-10-27T10:00:00.000Z",
    sections: [],
    checklistSummary: { total: 1, requiredPending: 0 },
    approvedAt: new Date()
  };
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: vi.fn(async () => [row])
  };
  const tx = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => ({ values: () => ({ onConflictDoUpdate: vi.fn(async () => undefined) }) })),
    execute: vi.fn(async () => undefined)
  };
  return {
    row,
    tx,
    getJob: vi.fn(async () => ({ id: row.jobId, scheduledStart: new Date() })),
    runTransactionWithTenantSession: vi.fn(async (_companyId: string, cb: (t: typeof tx) => unknown) => cb(tx)),
    emitEventWithExecutor: vi.fn(async () => undefined)
  };
});

vi.mock("@fsm/db", () => ({
  TENANT_SESSION_GUC: "app.current_company_id",
  db: {},
  jobs: {},
  jobServiceBriefs: {},
  emitEventWithExecutor: mocks.emitEventWithExecutor,
  runTransactionWithTenantSession: mocks.runTransactionWithTenantSession
}));

vi.mock("drizzle-orm", () => ({
  and: () => ({}),
  eq: () => ({}),
  isNull: () => ({}),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })
}));

vi.mock("./job.service.js", () => ({ getJob: mocks.getJob }));

import {
  applyApprovedJobServiceBrief,
  getJobPreparationStatus,
  getJobServiceBrief
} from "./job-service-brief.service.js";

const { companyId, jobId } = mocks.row;

describe("job-service-brief.service (FS-25 follow-up)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getJobPreparationStatus fetches the job once and reads the brief in a tenant session", async () => {
    const status = await getJobPreparationStatus(companyId, jobId);
    expect(status).toEqual({ readyForField: true, blockers: [] });
    expect(mocks.getJob).toHaveBeenCalledTimes(1);
    expect(mocks.runTransactionWithTenantSession).toHaveBeenCalledTimes(1);
    expect(mocks.runTransactionWithTenantSession.mock.calls[0]?.[0]).toBe(companyId);
  });

  it("getJobServiceBrief reads through runTransactionWithTenantSession", async () => {
    const brief = await getJobServiceBrief(companyId, jobId);
    expect(brief?.resourceVersion).toBe(mocks.row.resourceVersion);
    expect(mocks.runTransactionWithTenantSession).toHaveBeenCalledWith(companyId, expect.any(Function));
  });

  it("applyApprovedJobServiceBrief writes in a tenant session and sets the tenant GUC", async () => {
    await applyApprovedJobServiceBrief({
      companyId,
      jobId,
      actorId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      agentActionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      parameters: {
        summary: "Brief",
        brief: {
          contractVersion: "1.0.0",
          jobId,
          companyId,
          resourceVersion: mocks.row.resourceVersion,
          sections: [],
          checklistSummary: { total: 0, requiredPending: 0 }
        }
      }
    });
    expect(mocks.runTransactionWithTenantSession).toHaveBeenCalledWith(companyId, expect.any(Function));
    expect(mocks.tx.execute).toHaveBeenCalledTimes(1);
    const setConfig = (mocks.tx.execute.mock.calls as unknown[][])[0]?.[0] as unknown as { values: unknown[] };
    expect(setConfig.values).toEqual(["app.current_company_id", companyId]);
    expect(mocks.tx.insert).toHaveBeenCalledTimes(1);
    expect(mocks.emitEventWithExecutor).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ eventType: "job.service_brief.approved" }));
  });
});
