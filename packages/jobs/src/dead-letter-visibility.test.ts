import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { QUEUE_PLATFORM_CONTRACT_VERSION } from "@fsm/types";

import { listDeadLetterJobs } from "./dead-letter-visibility.js";

function mockDlqJob(id: string, envelope: Record<string, unknown>): Job {
  return {
    id,
    data: envelope
  } as Job;
}

describe("listDeadLetterJobs", () => {
  it("maps DLQ waiting jobs to contract summaries with pagination cursor", async () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    const envelope = {
      contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
      sourceQueue: "imports",
      sourceJobId: "job-1",
      jobName: "migrate-file-batch",
      companyId,
      payload: { companyId },
      attemptsMade: 5,
      failedAt: "2026-10-23T12:00:00.000Z",
      failureClass: "transient",
      errorMessage: "partial object failure"
    };

    const probe = {
      getWaiting: vi.fn(async () => [
        mockDlqJob("dlq-1", envelope),
        mockDlqJob("dlq-2", envelope)
      ]),
      getDelayed: vi.fn(),
      getFailed: vi.fn()
    };

    const list = await listDeadLetterJobs("imports", probe, { start: 0, limit: 1 });

    expect(list.contractVersion).toBe(QUEUE_PLATFORM_CONTRACT_VERSION);
    expect(list.sourceQueue).toBe("imports");
    expect(list.deadLetterQueueName).toBe("imports-dlq");
    expect(list.jobs).toHaveLength(1);
    expect(list.jobs[0]).toMatchObject({
      deadLetterJobId: "dlq-1",
      jobName: "migrate-file-batch",
      companyId
    });
    expect(list.nextCursor).toBe("1");
  });
});
