// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildSyncBatch, enqueueNote, flushQueue, readQueue } from "./field-work-queue";

const JOB = "11111111-1111-4111-8111-111111111111";

beforeEach(() => window.localStorage.clear());

describe("field-work offline queue", () => {
  it("builds a v1 batch with sequential note.append operations", () => {
    enqueueNote(JOB, "Gas off");
    enqueueNote(JOB, "Old unit out");
    const batch = buildSyncBatch(readQueue(), "dev-1", "batch-1");
    expect(batch.contractVersion).toBe("1.0.0");
    expect(batch.operations.map((op) => op.sequence)).toEqual([1, 2]);
    expect(batch.operations[0]).toMatchObject({ type: "job.note.append", jobId: JOB, payload: { content: "Gas off" } });
  });

  it("removes applied/duplicate ops, reports rejected, keeps queue on network error", async () => {
    const a = enqueueNote(JOB, "a");
    const b = enqueueNote(JOB, "b");
    const c = enqueueNote(JOB, "c");

    await expect(flushQueue(() => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    expect(readQueue()).toHaveLength(3);

    const post = vi.fn().mockResolvedValue({
      contractVersion: "1.0.0",
      batchId: "22222222-2222-4222-8222-222222222222",
      deviceId: "d",
      batchClientId: "b",
      lastAcknowledgedSequence: 3,
      results: [
        { clientOperationId: a.clientOperationId, sequence: 1, outcome: "applied" },
        { clientOperationId: b.clientOperationId, sequence: 2, outcome: "duplicate" },
        { clientOperationId: c.clientOperationId, sequence: 3, outcome: "rejected", message: "Job not assigned" }
      ]
    });
    const result = await flushQueue(post);
    expect(result).toEqual({ applied: 2, rejected: [{ clientOperationId: c.clientOperationId, message: "Job not assigned" }], remaining: 0 });
    expect(post.mock.calls[0]?.[0].deviceId).toMatch(/^web-/);
    expect(readQueue()).toEqual([]);
  });
});
