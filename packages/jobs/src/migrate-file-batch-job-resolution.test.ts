import { describe, expect, it, vi } from "vitest";

import { findLatestMigrateFileBatchJob } from "./migrate-file-batch-job-resolution.js";
import { importsQueue } from "./queues.js";

vi.mock("./queues.js", () => ({
  importsQueue: {
    getJob: vi.fn()
  }
}));

describe("findLatestMigrateFileBatchJob", () => {
  const importSessionId = "22222222-2222-4222-8222-222222222222";

  it("returns the highest retry generation when present", async () => {
    vi.mocked(importsQueue.getJob).mockImplementation(async (jobId) => {
      if (jobId === `migrate-file-batch-${importSessionId}-0`) {
        return { id: "primary" } as never;
      }

      if (jobId === `migrate-file-batch-retry-${importSessionId}-0-1`) {
        return { id: "retry-1" } as never;
      }

      if (jobId === `migrate-file-batch-retry-${importSessionId}-0-2`) {
        return { id: "retry-2" } as never;
      }

      return null;
    });

    const job = await findLatestMigrateFileBatchJob(importSessionId, 0);
    expect(job?.id).toBe("retry-2");
  });
});
