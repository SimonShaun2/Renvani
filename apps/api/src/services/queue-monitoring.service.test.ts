import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppError,
  ErrorCode,
  QUEUE_PLATFORM_CONTRACT_VERSION,
  type DeadLetterRecoveryRequestV1
} from "@fsm/types";

const mocks = vi.hoisted(() => ({
  recoverDeadLetterJob: vi.fn()
}));

vi.mock("@fsm/jobs", () => ({
  getPlatformQueueMonitoringSnapshot: vi.fn(),
  listPlatformDeadLetterJobs: vi.fn(),
  listPlatformFailedJobsWithReplayMetadata: vi.fn(),
  platformQueuesByName: {
    imports: { name: "imports" }
  },
  recoverDeadLetterJob: mocks.recoverDeadLetterJob
}));

import { recoverPlatformDeadLetterJob } from "./queue-monitoring.service.js";

const request = {
  contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
  sourceQueue: "imports",
  deadLetterJobId: "dlq-command-1"
} satisfies DeadLetterRecoveryRequestV1;

describe("recoverPlatformDeadLetterJob", () => {
  beforeEach(() => {
    mocks.recoverDeadLetterJob.mockReset();
  });

  it("preserves a stable recovered ID across a lost-response retry", async () => {
    mocks.recoverDeadLetterJob.mockResolvedValue("fsm-recover-stable");

    const first = await recoverPlatformDeadLetterJob("imports", request);
    const retry = await recoverPlatformDeadLetterJob("imports", request);

    expect(first).toEqual({ recoveredQueueJobId: "fsm-recover-stable" });
    expect(retry).toEqual(first);
  });

  it("preserves an explicit NOT_FOUND outcome", async () => {
    mocks.recoverDeadLetterJob.mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND, "Dead-letter job was not found or recovered")
    );

    await expect(recoverPlatformDeadLetterJob("imports", request)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });
});
