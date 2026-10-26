import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueueMock, emitEventMock, featureFlagsMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn(),
  emitEventMock: vi.fn(),
  featureFlagsMock: {
    loyaltyRemindersEnabled: true,
    loyaltyRemindersDryRun: true
  }
}));

vi.mock("@fsm/jobs", () => ({
  enqueueEvaluateLoyaltyReminderCandidatesJob: enqueueMock
}));

vi.mock("@fsm/db", () => ({
  emitEvent: emitEventMock
}));

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: featureFlagsMock
}));

import { enqueuePostJobLoyaltyReminderEvaluation } from "./loyalty-reminder-post-job.service.js";

describe("loyalty-reminder-post-job.service", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const customerId = "22222222-2222-4222-8222-222222222222";
  const triggerJobId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    enqueueMock.mockReset();
    emitEventMock.mockReset();
    featureFlagsMock.loyaltyRemindersEnabled = true;
    featureFlagsMock.loyaltyRemindersDryRun = true;
  });

  it("skips enqueue when loyalty reminders are disabled", async () => {
    featureFlagsMock.loyaltyRemindersEnabled = false;

    const outcome = await enqueuePostJobLoyaltyReminderEvaluation({
      companyId,
      customerId,
      triggerJobId
    });

    expect(outcome).toBe("skipped_disabled");
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("enqueues idempotent post-job evaluation and emits audit receipt", async () => {
    const outcome = await enqueuePostJobLoyaltyReminderEvaluation({
      companyId,
      customerId,
      triggerJobId
    });

    expect(outcome).toBe("scheduled");
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        customerId,
        triggerJobId,
        idempotencyKey: `loyalty:post-job:${companyId}:${triggerJobId}`,
        dryRun: true
      })
    );
    expect(emitEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "ai.recommendation_created",
        entityId: triggerJobId
      })
    );
  });
});
