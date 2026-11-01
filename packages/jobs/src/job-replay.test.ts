import { describe, expect, it, vi } from "vitest";

import { replayFailedJobById, resolveCompanyIdFromJobData } from "./job-replay.js";
import { QUEUE_NAMES } from "./queue-names.js";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const OPERATOR_ID = "33333333-3333-4333-8333-333333333333";
const REPLAY_REASON = "Provider outage was resolved by operations";

const auditInput = {
  expectedCompanyId: COMPANY_ID,
  requestedByUserId: OPERATOR_ID,
  reason: REPLAY_REASON
};

describe("resolveCompanyIdFromJobData", () => {
  it("returns companyId when present on the payload", () => {
    expect(resolveCompanyIdFromJobData({ companyId: COMPANY_ID })).toBe(COMPANY_ID);
  });

  it("returns undefined for missing or invalid payloads", () => {
    expect(resolveCompanyIdFromJobData(null)).toBeUndefined();
    expect(resolveCompanyIdFromJobData({ companyId: 1 })).toBeUndefined();
  });
});

describe("replayFailedJobById", () => {
  it("replays a non-exhausted failed job when tenant scope matches", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        id: "job-1",
        data: { companyId: COMPANY_ID },
        opts: { attempts: 3 },
        attemptsMade: 1,
        getState: vi.fn().mockResolvedValue("failed"),
        retry
      })
    };

    const result = await replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.notifications,
      jobId: "job-1",
      ...auditInput
    });

    expect(result).toEqual({
      jobId: "job-1",
      queueName: QUEUE_NAMES.notifications,
      companyId: COMPANY_ID,
      requestedByUserId: OPERATOR_ID,
      reason: REPLAY_REASON
    });
    expect(retry).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith("failed");
  });

  it("requires exhausted jobs to use the sole dead-letter recovery path", async () => {
    const retry = vi.fn();
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        data: { companyId: COMPANY_ID },
        opts: { attempts: 3 },
        attemptsMade: 3,
        getState: vi.fn().mockResolvedValue("failed"),
        retry
      })
    };

    await expect(replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.notifications,
      jobId: "exhausted-job",
      ...auditInput
    })).rejects.toMatchObject({ code: "DEAD_LETTER_ONLY" });
    expect(retry).not.toHaveBeenCalled();
  });

  it("does not report success when a competing replay already moved the job", async () => {
    const retry = vi.fn().mockRejectedValue(new Error("Job is not in the failed state"));
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        data: { companyId: COMPANY_ID },
        opts: { attempts: 3 },
        attemptsMade: 1,
        getState: vi.fn().mockResolvedValue("failed"),
        retry
      })
    };

    await expect(replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.notifications,
      jobId: "raced-job",
      ...auditInput
    })).rejects.toThrow("Job is not in the failed state");
    expect(retry).toHaveBeenCalledOnce();
  });

  it("rejects replay when a tenant-owned job is not in failed state", async () => {
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        id: "job-2",
        data: { companyId: COMPANY_ID },
        getState: vi.fn().mockResolvedValue("completed"),
        retry: vi.fn()
      })
    };

    await expect(replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.ai,
      jobId: "job-2",
      ...auditInput
    })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("rejects cross-tenant replay before reading job state", async () => {
    const getState = vi.fn();
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        id: "job-3",
        data: { companyId: "11111111-1111-4111-8111-111111111111" },
        getState,
        retry: vi.fn()
      })
    };

    await expect(replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.imports,
      jobId: "job-3",
      ...auditInput
    })).rejects.toMatchObject({ name: "JobReplayError", code: "FORBIDDEN" });
    expect(getState).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when the job id does not exist", async () => {
    const queue = { getJob: vi.fn().mockResolvedValue(undefined) };

    await expect(replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.invoices,
      jobId: "missing",
      ...auditInput
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([
    { field: "expectedCompanyId", value: "not-a-uuid" },
    { field: "requestedByUserId", value: "not-a-uuid" },
    { field: "reason", value: "short" }
  ] as const)("rejects invalid $field before reading the queue", async ({ field, value }) => {
    const getJob = vi.fn();
    const input = {
      queueName: QUEUE_NAMES.notifications,
      jobId: "job-4",
      ...auditInput,
      [field]: value
    };

    await expect(replayFailedJobById({ getJob }, input)).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
    expect(getJob).not.toHaveBeenCalled();
  });

  it("rejects a failed job whose payload has no valid companyId before reading state", async () => {
    const retry = vi.fn();
    const getState = vi.fn();
    const queue = {
      getJob: vi.fn().mockResolvedValue({ data: {}, getState, retry })
    };

    await expect(replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.notifications,
      jobId: "job-5",
      ...auditInput
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getState).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });
});
