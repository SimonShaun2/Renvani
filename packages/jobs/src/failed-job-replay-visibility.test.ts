import { describe, expect, it, vi } from "vitest";

import { listFailedJobsWithReplayMetadata } from "./failed-job-replay-visibility.js";

describe("listFailedJobsWithReplayMetadata", () => {
  it("returns only failed jobs matching companyId", async () => {
    const queue = {
      getFailed: vi.fn().mockResolvedValue([
        {
          id: "1",
          name: "notify",
          data: { companyId: "11111111-1111-4111-8111-111111111111" },
          attemptsMade: 2,
          finishedOn: Date.parse("2026-10-23T12:00:00.000Z"),
          failedReason: "boom"
        },
        {
          id: "2",
          name: "notify",
          data: { companyId: "22222222-2222-4222-8222-222222222222" },
          attemptsMade: 1,
          finishedOn: Date.parse("2026-10-23T12:01:00.000Z"),
          failedReason: "other"
        }
      ])
    };

    const result = await listFailedJobsWithReplayMetadata("notifications", queue, {
      companyId: "11111111-1111-4111-8111-111111111111",
      limit: 10
    });

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.jobId).toBe("1");
    expect(result.jobs[0]?.replayable).toBe(true);
  });
});
