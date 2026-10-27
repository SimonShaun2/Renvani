import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emitReceiptMock } = vi.hoisted(() => ({
  emitReceiptMock: vi.fn()
}));

vi.mock("../lib/loyalty-reminder-evaluation-receipt.js", () => ({
  emitLoyaltyReminderEvaluationReceipt: emitReceiptMock
}));

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: {
    loyaltyRemindersEnabled: true,
    loyaltyRemindersDryRun: true
  }
}));

import { processEvaluateLoyaltyReminderCandidates } from "./loyalty-reminder-candidates.processor.js";

function createJob(data: Record<string, unknown>): Job<Record<string, unknown>> {
  return {
    id: "job-loyalty",
    name: "evaluate-loyalty-reminder-candidates",
    data,
    updateProgress: vi.fn(async () => undefined)
  } as unknown as Job<Record<string, unknown>>;
}

describe("loyalty-reminder-candidates.processor", () => {
  const evaluateCandidates = vi.fn(async () => [
    {
      ruleFamily: "plan_cadence" as const,
      customerId: "cust-1",
      customerName: "Ada",
      maintenancePlanId: "plan-1",
      evidenceJobId: null,
      importSessionId: null,
      planName: "Quarterly",
      nextServiceDate: "2026-10-30",
      lastServiceDate: null,
      daysUntilDue: 7,
      daysSinceLastService: null,
      dryRun: true
    }
  ]);
  const syncDryRunRecommendations = vi.fn(async () => ({
    createdCount: 1,
    skippedExistingCount: 0
  }));

  beforeEach(() => {
    evaluateCandidates.mockClear();
    syncDryRunRecommendations.mockClear();
    emitReceiptMock.mockReset();
  });

  it("evaluates candidates and syncs dry-run recommendations", async () => {
    const job = createJob({
      companyId: "11111111-1111-4111-8111-111111111111",
      importSessionId: "22222222-2222-4222-8222-222222222222",
      horizonDays: 21,
      idempotencyKey: "loyalty:manual:company-1:test"
    });

    await processEvaluateLoyaltyReminderCandidates(job, {
      evaluateCandidates,
      syncDryRunRecommendations
    });

    expect(evaluateCandidates).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", {
      horizonDays: 21,
      importSessionId: "22222222-2222-4222-8222-222222222222",
      customerId: null,
      lapsedDays: undefined,
      dryRun: true
    });
    expect(syncDryRunRecommendations).toHaveBeenCalled();
    expect(job.updateProgress).toHaveBeenCalledWith(100);
    expect(emitReceiptMock).toHaveBeenCalledWith(
      expect.objectContaining({ state: "completed", candidateCount: 1 })
    );
  });
});
