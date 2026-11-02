import { beforeEach, describe, expect, it, vi } from "vitest";

const add = vi.hoisted(() => vi.fn(async () => undefined));
const getJob = vi.hoisted(() => vi.fn(async () => null as null | {
  getState: () => Promise<string>;
  retry: (state: string, options: { resetAttemptsMade: boolean }) => Promise<void>;
}));

vi.mock("./queues.js", () => ({ webhooksQueue: { add, getJob } }));

import {
  CLERK_WORKSPACE_CREATE_JOB_NAME,
  CLERK_WORKSPACE_RECONCILE_JOB_NAME,
  enqueueClerkWorkspaceCreateJob,
  enqueueClerkWorkspaceReconcileJob
} from "./clerk-workspace.js";

const payload = {
  intentId: "11111111-1111-4111-8111-111111111111",
  clerkUserId: "user_1"
};

describe("FS-235 Clerk workspace queue contract", () => {
  beforeEach(() => {
    add.mockClear();
    getJob.mockReset().mockResolvedValue(null);
  });

  it("enqueues one non-retryable create attempt with a deterministic id", async () => {
    await enqueueClerkWorkspaceCreateJob(payload);
    await enqueueClerkWorkspaceCreateJob(payload);

    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenNthCalledWith(1, CLERK_WORKSPACE_CREATE_JOB_NAME, payload, {
      jobId: `clerk-workspace-create-${payload.intentId}`,
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true
    });
    expect(add.mock.calls[1]?.[2]).toMatchObject({
      jobId: `clerk-workspace-create-${payload.intentId}`,
      attempts: 1
    });
  });

  it("enqueues restartable bounded reconciliation separately from provider creation", async () => {
    await enqueueClerkWorkspaceReconcileJob(payload);
    await enqueueClerkWorkspaceReconcileJob(payload);

    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenNthCalledWith(1, CLERK_WORKSPACE_RECONCILE_JOB_NAME, payload, {
      jobId: `clerk-workspace-reconcile-${payload.intentId}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: true,
      removeOnFail: false
    });
    expect(add.mock.calls[1]?.[2]).toHaveProperty("jobId", `clerk-workspace-reconcile-${payload.intentId}`);
  });

  it("does not amplify an active reconciliation and retries an exhausted one in place", async () => {
    const retry = vi.fn(async () => undefined);
    const getState = vi.fn(async () => "waiting");
    getJob.mockResolvedValue({ getState, retry });
    await enqueueClerkWorkspaceReconcileJob(payload);
    expect(add).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();

    getState.mockResolvedValue("failed");
    await enqueueClerkWorkspaceReconcileJob(payload);
    expect(retry).toHaveBeenCalledWith("failed", { resetAttemptsMade: true });
    expect(add).not.toHaveBeenCalled();
  });

  it("accepts a concurrent retry that already moved the failed job", async () => {
    const getState = vi.fn().mockResolvedValueOnce("failed").mockResolvedValueOnce("waiting");
    const retry = vi.fn().mockRejectedValue(new Error("job is not in failed state"));
    getJob.mockResolvedValue({ getState, retry });
    await expect(enqueueClerkWorkspaceReconcileJob(payload)).resolves.toBeUndefined();
    expect(add).not.toHaveBeenCalled();
  });

  it("rejects malformed or client-expanded job payloads at the queue boundary", async () => {
    await expect(enqueueClerkWorkspaceCreateJob({ ...payload, clerkUserId: "" })).rejects.toThrow();
    await expect(enqueueClerkWorkspaceReconcileJob({
      ...payload,
      tenantId: "not-accepted"
    } as typeof payload)).rejects.toThrow();
    expect(add).not.toHaveBeenCalled();
  });
});
