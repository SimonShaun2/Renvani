import type { Job, Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import {
  QUEUE_PLATFORM_CONTRACT_VERSION,
  type DeadLetterJobEnvelopeV1,
  type DeadLetterRecoveryRequestV1
} from "@fsm/types";

import {
  buildDeadLetterEnvelope,
  buildDeadLetterForwardJobId,
  buildDeadLetterQueueName,
  buildDeadLetterRecoveryJobId,
  isJobExhausted,
  recoverDeadLetterJob
} from "./dead-letter-queue.js";

vi.mock("./queues.js", () => ({
  queueBaseOptions: { connection: {} }
}));

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const OPERATOR_ID = "22222222-2222-4222-8222-222222222222";

function mockJob(partial: {
  id: string;
  name: string;
  data: Record<string, unknown>;
  attemptsMade: number;
  attempts?: number;
}): Job<Record<string, unknown>> {
  return {
    id: partial.id,
    name: partial.name,
    data: partial.data,
    attemptsMade: partial.attemptsMade,
    opts: { attempts: partial.attempts ?? 5 }
  } as Job<Record<string, unknown>>;
}

describe("isJobExhausted", () => {
  it("returns false while attempts remain", () => {
    const job = mockJob({
      id: "1",
      name: "work",
      data: {},
      attemptsMade: 2,
      attempts: 5
    });

    expect(isJobExhausted(job)).toBe(false);
  });

  it("returns true when attemptsMade reaches configured attempts", () => {
    const job = mockJob({
      id: "1",
      name: "work",
      data: {},
      attemptsMade: 5,
      attempts: 5
    });

    expect(isJobExhausted(job)).toBe(true);
  });

  it("defaults to one attempt when opts.attempts is missing", () => {
    const job = mockJob({
      id: "1",
      name: "work",
      data: {},
      attemptsMade: 1
    });
    job.opts = {};

    expect(isJobExhausted(job)).toBe(true);
  });
});

describe("buildDeadLetterEnvelope", () => {
  it("builds a contract-shaped envelope with optional companyId", () => {
    const job = mockJob({
      id: "job-42",
      name: "send-sms",
      data: { companyId: COMPANY_ID, foo: "bar" },
      attemptsMade: 5,
      attempts: 5
    });

    const envelope = buildDeadLetterEnvelope("fsm:notifications", job, new Error("timeout"));

    expect(envelope.contractVersion).toBe(QUEUE_PLATFORM_CONTRACT_VERSION);
    expect(envelope.sourceQueue).toBe("fsm:notifications");
    expect(envelope.sourceJobId).toBe("job-42");
    expect(envelope.jobName).toBe("send-sms");
    expect(envelope.companyId).toBe(COMPANY_ID);
    expect(envelope.payload).toEqual({ companyId: COMPANY_ID, foo: "bar" });
    expect(envelope.attemptsMade).toBe(5);
    expect(envelope.failureClass).toBe("transient");
    expect(envelope.errorMessage).toBe("timeout");
    expect(envelope.failedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("omits companyId when payload is not tenant-scoped", () => {
    const job = mockJob({
      id: "2",
      name: "nightly",
      data: { scope: "system" },
      attemptsMade: 3,
      attempts: 3
    });

    const envelope = buildDeadLetterEnvelope("fsm:ai", job, new Error("boom"));

    expect(envelope.companyId).toBeUndefined();
    expect(envelope.failureClass).toBe("unknown");
  });
});

describe("buildDeadLetterQueueName", () => {
  it("suffixes the source queue with -dlq", () => {
    expect(buildDeadLetterQueueName("fsm:notifications")).toBe("fsm:notifications-dlq");
  });
});

describe("dead-letter operation job ids", () => {
  it("builds stable colon-free IDs accepted by BullMQ custom job validation", () => {
    const forwarded = buildDeadLetterForwardJobId("imports", "fs81-smoke:source:1");
    const recovered = buildDeadLetterRecoveryJobId("imports", "fs81-smoke:source:1");

    expect(forwarded).toMatch(/^fsm-dlq-[a-f0-9]{32}$/);
    expect(recovered).toMatch(/^fsm-recover-[a-f0-9]{32}$/);
    expect(forwarded).not.toContain(":");
    expect(recovered).not.toContain(":");
    expect(buildDeadLetterRecoveryJobId("imports", "fs81-smoke:source:1")).toBe(recovered);
    expect(buildDeadLetterRecoveryJobId("imports", "fs81-smoke:source:2")).not.toBe(recovered);
  });
});

describe("recoverDeadLetterJob", () => {
  const request: DeadLetterRecoveryRequestV1 = {
    contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
    sourceQueue: "imports",
    deadLetterJobId: "fs81-smoke-1793548157144",
    requestedByUserId: OPERATOR_ID
  };

  const envelope: DeadLetterJobEnvelopeV1 = {
    contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
    sourceQueue: "imports",
    sourceJobId: "source:job:42",
    jobName: "execute-import",
    companyId: COMPANY_ID,
    payload: { companyId: COMPANY_ID, importSessionId: "session-1" },
    attemptsMade: 5,
    failedAt: "2026-11-01T15:00:00.000Z",
    failureClass: "transient",
    errorMessage: "provider timeout"
  };

  it("re-enqueues with a deterministic valid ID and removes the DLQ copy", async () => {
    const remove = vi.fn(async () => undefined);
    const sourceAdd = vi.fn(async (
      _name: string,
      _payload: Record<string, unknown>,
      options: { jobId?: string }
    ) => {
      if (options.jobId?.includes(":")) {
        throw new Error("Custom Id cannot contain :");
      }

      return { id: options.jobId };
    });
    const deadLetterQueue = {
      getJob: vi.fn(async () => ({ data: envelope, remove }))
    };

    const recoveredJobId = await recoverDeadLetterJob(
      { name: "imports", add: sourceAdd, getJob: vi.fn() } as unknown as Queue,
      request,
      { getDeadLetterQueue: () => deadLetterQueue as unknown as Pick<Queue, "getJob"> }
    );

    expect(recoveredJobId).toBe(buildDeadLetterRecoveryJobId("imports", request.deadLetterJobId));
    expect(sourceAdd).toHaveBeenCalledWith(
      envelope.jobName,
      envelope.payload,
      expect.objectContaining({ jobId: recoveredJobId })
    );
    expect(remove).toHaveBeenCalledOnce();
  });

  it("returns the same recovered job after a lost response without enqueueing again", async () => {
    const recoveredJobs = new Map<string, { id: string }>();
    const remove = vi.fn(async () => undefined);
    const deadLetterQueue = {
      getJob: vi.fn()
        .mockResolvedValueOnce({ data: envelope, remove })
        .mockResolvedValueOnce(undefined)
    };
    const sourceAdd = vi.fn(async (
      _name: string,
      _payload: Record<string, unknown>,
      options: { jobId?: string }
    ) => {
      const id = String(options.jobId);
      const job = { id };
      recoveredJobs.set(id, job);
      return job;
    });
    const sourceGetJob = vi.fn(async (jobId: string) => recoveredJobs.get(jobId));
    const sourceQueue = {
      name: "imports",
      add: sourceAdd,
      getJob: sourceGetJob
    } as unknown as Queue;
    const deps = {
      getDeadLetterQueue: () => deadLetterQueue as unknown as Pick<Queue, "getJob">
    };

    const firstResult = await recoverDeadLetterJob(sourceQueue, request, deps);
    const retryResult = await recoverDeadLetterJob(sourceQueue, request, deps);

    expect(retryResult).toBe(firstResult);
    expect(sourceAdd).toHaveBeenCalledOnce();
    expect(sourceGetJob).toHaveBeenCalledWith(firstResult);
    expect(remove).toHaveBeenCalledOnce();
  });

  it("returns the same recovered job when a retry overlaps DLQ removal", async () => {
    const recoveredJobs = new Map<string, { id: string }>();
    let deadLetterJobPresent = true;
    let signalSecondRemove: (() => void) | undefined;
    let signalFirstRemoved: (() => void) | undefined;
    const secondRemoveStarted = new Promise<void>((resolve) => {
      signalSecondRemove = resolve;
    });
    const firstRemoveCompleted = new Promise<void>((resolve) => {
      signalFirstRemoved = resolve;
    });
    let removeCalls = 0;
    const remove = vi.fn(async () => {
      removeCalls += 1;

      if (removeCalls === 1) {
        await secondRemoveStarted;
        deadLetterJobPresent = false;
        signalFirstRemoved?.();
        return;
      }

      signalSecondRemove?.();
      await firstRemoveCompleted;
      throw new Error("Job was already removed by the overlapping recovery");
    });
    const deadLetterJob = { data: envelope, remove };
    const deadLetterQueue = {
      getJob: vi.fn(async () => deadLetterJobPresent ? deadLetterJob : undefined)
    };
    const sourceAdd = vi.fn(async (
      _name: string,
      _payload: Record<string, unknown>,
      options: { jobId?: string }
    ) => {
      const id = String(options.jobId);
      const existing = recoveredJobs.get(id);

      if (existing) {
        return existing;
      }

      const job = { id };
      recoveredJobs.set(id, job);
      return job;
    });
    const sourceGetJob = vi.fn(async (jobId: string) => recoveredJobs.get(jobId));
    const sourceQueue = {
      name: "imports",
      add: sourceAdd,
      getJob: sourceGetJob
    } as unknown as Queue;
    const deps = {
      getDeadLetterQueue: () => deadLetterQueue as unknown as Pick<Queue, "getJob">
    };

    const [firstResult, overlappingRetryResult] = await Promise.all([
      recoverDeadLetterJob(sourceQueue, request, deps),
      recoverDeadLetterJob(sourceQueue, request, deps)
    ]);

    expect(overlappingRetryResult).toBe(firstResult);
    expect(sourceAdd).toHaveBeenCalledTimes(2);
    expect(recoveredJobs).toHaveLength(1);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(sourceGetJob).toHaveBeenCalledWith(firstResult);
  });

  it("does not hide a removal failure while the DLQ copy is still present", async () => {
    const removalError = new Error("DLQ job is still locked");
    const remove = vi.fn(async () => {
      throw removalError;
    });
    const deadLetterJob = { data: envelope, remove };
    const deadLetterQueue = {
      getJob: vi.fn(async () => deadLetterJob)
    };
    const recoveredJobId = buildDeadLetterRecoveryJobId("imports", request.deadLetterJobId);
    const sourceAdd = vi.fn(async () => ({ id: recoveredJobId }));
    const sourceGetJob = vi.fn(async () => ({ id: recoveredJobId }));

    await expect(recoverDeadLetterJob(
      { name: "imports", add: sourceAdd, getJob: sourceGetJob } as unknown as Queue,
      request,
      { getDeadLetterQueue: () => deadLetterQueue as unknown as Pick<Queue, "getJob"> }
    )).rejects.toBe(removalError);
    expect(deadLetterQueue.getJob).toHaveBeenCalledTimes(2);
    expect(sourceGetJob).toHaveBeenCalledWith(recoveredJobId);
  });

  it("returns explicit NOT_FOUND when neither the DLQ nor recovered job exists", async () => {
    const sourceAdd = vi.fn();
    const sourceGetJob = vi.fn(async () => undefined);
    const deadLetterQueue = { getJob: vi.fn(async () => undefined) };

    await expect(recoverDeadLetterJob(
      { name: "imports", add: sourceAdd, getJob: sourceGetJob } as unknown as Queue,
      request,
      { getDeadLetterQueue: () => deadLetterQueue as unknown as Pick<Queue, "getJob"> }
    )).rejects.toMatchObject({ name: "AppError", code: "NOT_FOUND" });
    expect(sourceAdd).not.toHaveBeenCalled();
    expect(sourceGetJob).toHaveBeenCalledWith(
      buildDeadLetterRecoveryJobId("imports", request.deadLetterJobId)
    );
  });

  it("rejects target confusion before reading or mutating the DLQ", async () => {
    const sourceAdd = vi.fn();
    const getDeadLetterQueue = vi.fn();

    await expect(recoverDeadLetterJob(
      { name: "notifications", add: sourceAdd } as unknown as Queue,
      request,
      { getDeadLetterQueue }
    )).rejects.toThrow("Source queue object does not match recovery request");
    expect(getDeadLetterQueue).not.toHaveBeenCalled();
    expect(sourceAdd).not.toHaveBeenCalled();
  });

  it("fails closed when the stored envelope belongs to another source queue", async () => {
    const sourceAdd = vi.fn();
    const remove = vi.fn();
    const deadLetterQueue = {
      getJob: vi.fn(async () => ({
        data: { ...envelope, sourceQueue: "notifications" },
        remove
      }))
    };

    await expect(recoverDeadLetterJob(
      { name: "imports", add: sourceAdd, getJob: vi.fn() } as unknown as Queue,
      request,
      { getDeadLetterQueue: () => deadLetterQueue as unknown as Pick<Queue, "getJob"> }
    )).rejects.toThrow("Dead-letter job source queue mismatch");
    expect(sourceAdd).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("keeps the DLQ copy when re-enqueue fails", async () => {
    const remove = vi.fn();
    const sourceAdd = vi.fn(async () => {
      throw new Error("Redis unavailable");
    });
    const deadLetterQueue = {
      getJob: vi.fn(async () => ({ data: envelope, remove }))
    };

    await expect(recoverDeadLetterJob(
      { name: "imports", add: sourceAdd, getJob: vi.fn() } as unknown as Queue,
      request,
      { getDeadLetterQueue: () => deadLetterQueue as unknown as Pick<Queue, "getJob"> }
    )).rejects.toThrow("Redis unavailable");
    expect(remove).not.toHaveBeenCalled();
  });
});
