import { describe, expect, it, vi } from "vitest";

vi.mock("@fsm/db", () => ({
  listM8ReactivationSignalsFromImportedJobHistory: vi.fn(async () => [
    {
      customerId: "11111111-1111-4111-8111-111111111111",
      lastJobId: "22222222-2222-4222-8222-222222222222",
      lastServiceCompletedAt: "2025-01-01T00:00:00.000Z",
      daysSinceLastService: 120,
      ruleFamily: "lapsed_reactivation",
      importSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    }
  ])
}));

import { listM8ReactivationSignalsFromImportedJobHistory as listM8Db } from "@fsm/db";

import { listM8ReactivationSignalsFromImportedJobHistory } from "./migrate-job-history-reactivation.service.js";

describe("migrate-job-history-reactivation.service", () => {
  it("delegates to db read helper for FS-MIGRATE-M8 reactivation signals", async () => {
    const importSessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const signals = await listM8ReactivationSignalsFromImportedJobHistory("company-1", {
      importSessionId,
      lapsedDays: 30
    });

    expect(listM8Db).toHaveBeenCalledWith("company-1", { importSessionId, lapsedDays: 30 });
    expect(signals[0]?.ruleFamily).toBe("lapsed_reactivation");
  });
});
