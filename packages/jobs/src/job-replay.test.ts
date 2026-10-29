import { describe, expect, it, vi } from "vitest";

import { JobReplayError, replayFailedJobById, resolveCompanyIdFromJobData } from "./job-replay.js";
import { QUEUE_NAMES } from "./queues.js";

describe("resolveCompanyIdFromJobData", () => {
  it("returns companyId when present on the payload", () => {
    expect(resolveCompanyIdFromJobData({ companyId: "22222222-2222-4222-8222-222222222222" })).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
  });

  it("returns undefined for missing or invalid payloads", () => {
    expect(resolveCompanyIdFromJobData(null)).toBeUndefined();
    expect(resolveCompanyIdFromJobData({ companyId: 1 })).toBeUndefined();
  });
});

describe("replayFailedJobById", () => {
  it("replays a failed job when tenant scope matches", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        id: "job-1",
        data: { companyId: "22222222-2222-4222-8222-222222222222" },
        opts: { attempts: 3 },
        attemptsMade: 1,
        getState: vi.fn().mockResolvedValue("failed"),
        retry
      })
    };

    const result = await replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.notifications,
      jobId: "job-1",
      expectedCompanyId: "22222222-2222-4222-8222-222222222222"
    });

    expect(result).toEqual({
      jobId: "job-1",
      queueName: QUEUE_NAMES.notifications
    });
    expect(retry).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith("failed", {});
  });

  it("resets the attempt budget when replaying an exhausted job", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        data: { companyId: "22222222-2222-4222-8222-222222222222" },
        opts: { attempts: 3 },
        attemptsMade: 3,
        getState: vi.fn().mockResolvedValue("failed"),
        retry
      })
    };

    await replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.notifications,
      jobId: "exhausted-job",
      expectedCompanyId: "22222222-2222-4222-8222-222222222222"
    });

    expect(retry).toHaveBeenCalledWith("failed", { resetAttemptsMade: true });
  });

  it("does not report success when a competing replay already moved the job", async () => {
    const retry = vi.fn().mockRejectedValue(new Error("Job is not in the failed state"));
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        data: { companyId: "22222222-2222-4222-8222-222222222222" },
        opts: { attempts: 2 },
        attemptsMade: 2,
        getState: vi.fn().mockResolvedValue("failed"),
        retry
      })
    };

    await expect(replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.notifications,
      jobId: "raced-job",
      expectedCompanyId: "22222222-2222-4222-8222-222222222222"
    })).rejects.toThrow("Job is not in the failed state");
    expect(retry).toHaveBeenCalledOnce();
  });

  it("rejects replay when job is not in failed state", async () => {
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        id: "job-2",
        data: {},
        getState: vi.fn().mockResolvedValue("completed"),
        retry: vi.fn()
      })
    };

    await expect(
      replayFailedJobById(queue, {
        queueName: QUEUE_NAMES.ai,
        jobId: "job-2",
        expectedCompanyId: "22222222-2222-4222-8222-222222222222"
      })
    ).rejects.toMatchObject({
      code: "INVALID_STATE"
    });
  });

  it("rejects cross-tenant replay when expectedCompanyId is provided", async () => {
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        id: "job-3",
        data: { companyId: "11111111-1111-4111-8111-111111111111" },
        getState: vi.fn().mockResolvedValue("failed"),
        retry: vi.fn()
      })
    };

    await expect(
      replayFailedJobById(queue, {
        queueName: QUEUE_NAMES.imports,
        jobId: "job-3",
        expectedCompanyId: "22222222-2222-4222-8222-222222222222"
      })
    ).rejects.toBeInstanceOf(JobReplayError);

    await expect(
      replayFailedJobById(queue, {
        queueName: QUEUE_NAMES.imports,
        jobId: "job-3",
        expectedCompanyId: "22222222-2222-4222-8222-222222222222"
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN"
    });
  });

  it("returns NOT_FOUND when the job id does not exist", async () => {
    const queue = {
      getJob: vi.fn().mockResolvedValue(undefined)
    };

    await expect(
      replayFailedJobById(queue, {
        queueName: QUEUE_NAMES.invoices,
        jobId: "missing",
        expectedCompanyId: "22222222-2222-4222-8222-222222222222"
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
  });

  it("rejects a blank tenant scope before reading or retrying a failed job", async () => {
    const getJob = vi.fn();
    await expect(replayFailedJobById({ getJob }, {
      queueName: QUEUE_NAMES.notifications,
      jobId: "job-4",
      expectedCompanyId: "  "
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(getJob).not.toHaveBeenCalled();
  });

  it("rejects a failed job whose payload has no companyId", async () => {
    const retry = vi.fn();
    const queue = {
      getJob: vi.fn().mockResolvedValue({
        data: {},
        getState: vi.fn().mockResolvedValue("failed"),
        retry
      })
    };
    await expect(replayFailedJobById(queue, {
      queueName: QUEUE_NAMES.notifications,
      jobId: "job-5",
      expectedCompanyId: "22222222-2222-4222-8222-222222222222"
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(retry).not.toHaveBeenCalled();
  });
});
