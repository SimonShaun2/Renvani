import { beforeEach, describe, expect, it, vi } from "vitest";

const { add } = vi.hoisted(() => ({
  add: vi.fn()
}));

vi.mock("./queues.js", () => ({
  agreementsQueue: {
    add
  }
}));

import { enqueueEvaluateLoyaltyReminderCandidatesJob } from "./enqueue-evaluate-loyalty-reminder-candidates.js";

describe("enqueueEvaluateLoyaltyReminderCandidatesJob", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const jobId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    add.mockReset();
  });

  it("enqueues post-job evaluation with deterministic BullMQ job id", async () => {
    await enqueueEvaluateLoyaltyReminderCandidatesJob({
      companyId,
      customerId: "33333333-3333-4333-8333-333333333333",
      triggerJobId: jobId,
      idempotencyKey: `loyalty:post-job:${companyId}:${jobId}`,
      dryRun: true
    });

    expect(add).toHaveBeenCalledWith(
      "evaluate-loyalty-reminder-candidates",
      expect.objectContaining({
        companyId,
        triggerJobId: jobId
      }),
      expect.objectContaining({
        jobId: `loyalty-reminder-post-job-${companyId}-${jobId}`
      })
    );
  });
});
