import { describe, expect, it } from "vitest";

import {
  classifyJobFailureV1,
  DEFAULT_PLATFORM_QUEUE_RETRY_POLICY_V1,
  PlatformQueueRetryPolicyV1Schema
} from "./retry-policy.js";
import {
  DeadLetterJobEnvelopeV1Schema,
  DeadLetterRecoveryRequestV1Schema
} from "./dead-letter.js";
import { DeadLetterJobListV1Schema } from "./dead-letter-visibility.js";
import { PlatformQueueMonitoringSnapshotV1Schema } from "./monitoring.js";
import { QUEUE_PLATFORM_CONTRACT_VERSION } from "./constants.js";

describe("queue-platform v0.1", () => {
  it("parses default retry policy", () => {
    const parsed = PlatformQueueRetryPolicyV1Schema.parse(DEFAULT_PLATFORM_QUEUE_RETRY_POLICY_V1);
    expect(parsed.attempts).toBe(5);
    expect(parsed.removeOnFail).toBe(false);
  });

  it("classifies validation failures as permanent", () => {
    expect(classifyJobFailureV1(new Error("VALIDATION_ERROR: bad field"))).toBe("permanent");
  });

  it("parses dead-letter envelope", () => {
    const parsed = DeadLetterJobEnvelopeV1Schema.parse({
      contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
      sourceQueue: "notifications",
      sourceJobId: "job-1",
      jobName: "send-sms",
      payload: { companyId: "11111111-1111-4111-8111-111111111111" },
      attemptsMade: 5,
      failedAt: "2026-10-22T12:00:00.000Z",
      failureClass: "transient",
      errorMessage: "timeout"
    });

    expect(parsed.sourceQueue).toBe("notifications");
  });

  it.each(["constructor", "toString", "arbitrary-queue"])(
    "rejects unknown recovery source queue %s",
    (sourceQueue) => {
      expect(DeadLetterRecoveryRequestV1Schema.safeParse({
        contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
        sourceQueue,
        deadLetterJobId: "dead-letter-job-1"
      }).success).toBe(false);
    }
  );

  it("parses queue monitoring snapshot", () => {
    const parsed = PlatformQueueMonitoringSnapshotV1Schema.parse({
      contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
      collectedAt: "2026-10-23T12:00:00.000Z",
      queues: [
        {
          queueName: "imports",
          counts: {
            waiting: 0,
            active: 0,
            delayed: 0,
            failed: 0,
            paused: 0,
            backlog: 0
          },
          oldestJobAgeSeconds: null,
          deadLetter: {
            queueName: "imports-dlq",
            count: 0,
            oldestJobAgeSeconds: null
          }
        }
      ]
    });

    expect(parsed.queues[0].deadLetter.queueName).toBe("imports-dlq");
  });

  it("parses dead-letter job list", () => {
    const parsed = DeadLetterJobListV1Schema.parse({
      contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
      sourceQueue: "imports",
      deadLetterQueueName: "imports-dlq",
      jobs: [],
      nextCursor: null
    });

    expect(parsed.sourceQueue).toBe("imports");
  });
});
