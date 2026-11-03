import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { collectPlatformQueueMonitoringSnapshot, type QueueMonitoringProbe } from "./queue-monitoring.js";

function mockJob(timestamp: number): Job {
  return { timestamp } as Job;
}

function createProbe(options: {
  counts?: Partial<Record<"waiting" | "active" | "delayed" | "failed" | "paused", number>>;
  waitingHead?: Job[];
  delayedHead?: Job[];
  activeHead?: Job[];
  failedHead?: Job[];
}): QueueMonitoringProbe {
  const counts = {
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    paused: 0,
    ...options.counts
  };

  return {
    getJobCounts: vi.fn(async () => counts),
    getWaiting: vi.fn(async () => options.waitingHead ?? []),
    getDelayed: vi.fn(async () => options.delayedHead ?? []),
    getActive: vi.fn(async () => options.activeHead ?? []),
    getFailed: vi.fn(async () => options.failedHead ?? [])
  };
}

describe("collectPlatformQueueMonitoringSnapshot", () => {
  it("aggregates depth, backlog, oldest age, and DLQ counts per queue", async () => {
    const collectedAt = new Date("2026-10-23T12:00:00.000Z");
    const nowMs = collectedAt.getTime();
    const oldTimestamp = nowMs - 125_000;

    const notificationsQueue = createProbe({
      counts: { waiting: 3, active: 1, delayed: 2, failed: 4, paused: 0 },
      waitingHead: [mockJob(oldTimestamp)]
    });
    const notificationsDlq = createProbe({
      counts: { waiting: 2, active: 0, delayed: 0, failed: 0 },
      waitingHead: [mockJob(nowMs - 60_000)]
    });

    const defaultProbe = createProbe({ counts: { waiting: 0 } });
    const defaultDlq = createProbe({ counts: { waiting: 0 } });

    const queues = {
      imports: defaultProbe,
      ai: defaultProbe,
      notifications: notificationsQueue,
      invoices: defaultProbe,
      agreements: defaultProbe,
      webhooks: defaultProbe,
      operator: defaultProbe,
      exports: defaultProbe,
      growth: defaultProbe
    };

    const getDeadLetterQueue = vi.fn((name: string) => {
      if (name === "notifications") {
        return notificationsDlq;
      }

      return defaultDlq;
    });

    const snapshot = await collectPlatformQueueMonitoringSnapshot(
      { queues, getDeadLetterQueue },
      collectedAt
    );

    expect(snapshot.contractVersion).toBe("0.1.0");
    expect(snapshot.collectedAt).toBe("2026-10-23T12:00:00.000Z");
    expect(snapshot.queues).toHaveLength(9);

    const notifications = snapshot.queues.find((row) => row.queueName === "notifications");

    expect(notifications).toMatchObject({
      counts: {
        waiting: 3,
        active: 1,
        delayed: 2,
        failed: 4,
        paused: 0,
        backlog: 6
      },
      oldestJobAgeSeconds: 125,
      deadLetter: {
        queueName: "notifications-dlq",
        count: 2,
        oldestJobAgeSeconds: 60
      }
    });

    expect(getDeadLetterQueue).toHaveBeenCalledWith("notifications");
  });
});
