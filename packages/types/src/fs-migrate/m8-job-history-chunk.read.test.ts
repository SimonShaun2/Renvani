import { describe, expect, it } from "vitest";

import {
  deriveM8ReactivationSignalsFromJobHistory,
  type M8ImportedJobHistoryRow
} from "./m8-job-history-chunk.read.js";

const importSessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("FS-MIGRATE-M8 job history chunk read (reactivation)", () => {
  it("returns lapsed customers using business completion dates from a chunk window", () => {
    const rows: M8ImportedJobHistoryRow[] = [
      {
        customerId: "11111111-1111-4111-8111-111111111111",
        jobId: "22222222-2222-4222-8222-222222222222",
        serviceCompletedAt: new Date("2024-01-15T16:00:00.000Z")
      },
      {
        customerId: "11111111-1111-4111-8111-111111111111",
        jobId: "33333333-3333-4333-8333-333333333333",
        serviceCompletedAt: new Date("2025-06-01T12:00:00.000Z")
      },
      {
        customerId: "44444444-4444-4444-8444-444444444444",
        jobId: "55555555-5555-4555-8555-555555555555",
        serviceCompletedAt: new Date("2026-09-15T00:00:00.000Z")
      }
    ];

    const signals = deriveM8ReactivationSignalsFromJobHistory(rows, {
      importSessionId,
      lapsedDays: 90,
      asOf: new Date("2026-10-01T00:00:00.000Z")
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      customerId: "11111111-1111-4111-8111-111111111111",
      lastJobId: "33333333-3333-4333-8333-333333333333",
      ruleFamily: "lapsed_reactivation",
      importSessionId
    });
    expect(signals[0]?.daysSinceLastService).toBeGreaterThanOrEqual(90);
  });
});
