// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./api";
import {
  buildSyncBatch,
  clearFieldWorkQueues,
  enqueueNote,
  flushQueue,
  isRetryableSyncError,
  readQueue
} from "./field-work-queue";

const JOB = "11111111-1111-4111-8111-111111111111";
const ALICE = { userId: "u-alice", companyId: "c-1" };
const BOB = { userId: "u-bob", companyId: "c-1" };
const ALICE_OTHER_CO = { userId: "u-alice", companyId: "c-2" };

beforeEach(() => window.localStorage.clear());

function ok(results: Array<{ clientOperationId: string; outcome: string; message?: string }>) {
  return {
    contractVersion: "1.0.0",
    batchId: "22222222-2222-4222-8222-222222222222",
    deviceId: "d",
    batchClientId: "b",
    lastAcknowledgedSequence: results.length,
    results: results.map((r, i) => ({ sequence: i + 1, ...r }))
  };
}

describe("field-work offline queue", () => {
  it("builds a v1 batch with sequential note.append operations", () => {
    enqueueNote(ALICE, JOB, "Gas off");
    enqueueNote(ALICE, JOB, "Old unit out");
    const batch = buildSyncBatch(readQueue(ALICE), "dev-1", "batch-1");
    expect(batch.contractVersion).toBe("1.0.0");
    expect(batch.operations.map((op) => op.sequence)).toEqual([1, 2]);
    expect(batch.operations[0]).toMatchObject({ type: "job.note.append", jobId: JOB, payload: { content: "Gas off" } });
  });

  it("scopes the queue by user and company and clears other owners' queues", () => {
    enqueueNote(ALICE, JOB, "alice note");
    expect(readQueue(BOB)).toEqual([]);
    // Reading as Bob dropped Alice's queue from this browser.
    expect(readQueue(ALICE)).toEqual([]);

    enqueueNote(ALICE, JOB, "alice again");
    expect(readQueue(ALICE_OTHER_CO)).toEqual([]);
    expect(readQueue(ALICE)).toEqual([]);
  });

  it("ignores the old unscoped key and ops stamped for someone else", () => {
    window.localStorage.setItem("renvani.fieldWork.queue.v1", JSON.stringify([{ clientOperationId: "x", jobId: JOB }]));
    window.localStorage.setItem(
      "renvani.fieldWork.queue.v2:c-1:u-alice",
      JSON.stringify([{ clientOperationId: "y", userId: "u-bob", companyId: "c-1", jobId: JOB }])
    );
    expect(readQueue(ALICE)).toEqual([]);
    expect(window.localStorage.getItem("renvani.fieldWork.queue.v1")).toBeNull();
  });

  it("clearFieldWorkQueues (sign-out) removes every queue", () => {
    enqueueNote(ALICE, JOB, "a");
    clearFieldWorkQueues();
    expect(Object.keys(window.localStorage).filter((k) => k.includes("fieldWork.queue"))).toEqual([]);
  });

  it("classifies retryable vs permanent errors", () => {
    expect(isRetryableSyncError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryableSyncError(new ApiError(503, { error: "INTERNAL_ERROR", message: "down" } as never))).toBe(true);
    expect(isRetryableSyncError(new ApiError(408, { error: "INTERNAL_ERROR", message: "timeout" } as never))).toBe(true);
    expect(isRetryableSyncError(new ApiError(400, { error: "VALIDATION_ERROR", message: "bad" } as never))).toBe(false);
    expect(isRetryableSyncError(new ApiError(403, { error: "FORBIDDEN", message: "no" } as never))).toBe(false);
  });

  it("keeps the queue on network and 5xx failures", async () => {
    enqueueNote(ALICE, JOB, "a");
    await expect(flushQueue(ALICE, () => Promise.reject(new TypeError("Failed to fetch")))).rejects.toThrow();
    await expect(
      flushQueue(ALICE, () => Promise.reject(new ApiError(502, { error: "INTERNAL_ERROR", message: "bad gateway" } as never)))
    ).rejects.toThrow();
    expect(readQueue(ALICE)).toHaveLength(1);
  });

  it("drops only the bad op on a permanent 4xx so later notes still sync", async () => {
    const bad = enqueueNote(ALICE, JOB, "bad");
    const good = enqueueNote(ALICE, JOB, "good");
    const post = vi.fn(async (body: { operations: Array<{ clientOperationId: string }> }) => {
      if (body.operations.some((op) => op.clientOperationId === bad.clientOperationId)) {
        throw new ApiError(422, { error: "VALIDATION_ERROR", message: "Job not assigned" } as never);
      }
      return ok(body.operations.map((op) => ({ clientOperationId: op.clientOperationId, outcome: "applied" })));
    });
    const result = await flushQueue(ALICE, post as never);
    expect(result).toEqual({
      applied: 1,
      rejected: [{ clientOperationId: bad.clientOperationId, message: "Job not assigned" }],
      remaining: 0
    });
    expect(post).toHaveBeenCalledTimes(3);
    expect(readQueue(ALICE)).toEqual([]);
    expect(good.clientOperationId).toBeTruthy();
  });

  it("removes applied/duplicate ops and reports rejected outcomes", async () => {
    const a = enqueueNote(ALICE, JOB, "a");
    const b = enqueueNote(ALICE, JOB, "b");
    const c = enqueueNote(ALICE, JOB, "c");
    const post = vi.fn().mockResolvedValue(
      ok([
        { clientOperationId: a.clientOperationId, outcome: "applied" },
        { clientOperationId: b.clientOperationId, outcome: "duplicate" },
        { clientOperationId: c.clientOperationId, outcome: "rejected", message: "Job not assigned" }
      ])
    );
    const result = await flushQueue(ALICE, post);
    expect(result).toEqual({ applied: 2, rejected: [{ clientOperationId: c.clientOperationId, message: "Job not assigned" }], remaining: 0 });
    expect(post.mock.calls[0]?.[0].deviceId).toMatch(/^web-/);
  });
});
