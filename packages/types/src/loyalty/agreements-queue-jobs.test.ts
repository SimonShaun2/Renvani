import { describe, expect, it } from "vitest";

import {
  assertPostJobLoyaltyReminderIdempotencyKey,
  buildPostJobLoyaltyReminderEvaluationIdempotencyKey,
  buildPostJobLoyaltyReminderEvaluationJobId
} from "./agreements-queue-jobs.js";

describe("loyalty agreements queue jobs", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const jobId = "22222222-2222-4222-8222-222222222222";

  it("builds deterministic post-job ids", () => {
    expect(buildPostJobLoyaltyReminderEvaluationJobId(companyId, jobId)).toBe(
      `loyalty-reminder-post-job-${companyId}-${jobId}`
    );
    const key = buildPostJobLoyaltyReminderEvaluationIdempotencyKey(companyId, jobId);
    assertPostJobLoyaltyReminderIdempotencyKey(companyId, jobId, key);
    expect(() => assertPostJobLoyaltyReminderIdempotencyKey(companyId, jobId, "bad")).toThrow();
  });
});
