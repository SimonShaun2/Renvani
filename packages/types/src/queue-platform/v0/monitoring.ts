import { z } from "zod";

import { QUEUE_PLATFORM_CONTRACT_VERSION } from "./constants.js";

export const PLATFORM_QUEUE_NAMES_V1 = [
  "imports",
  "ai",
  "notifications",
  "invoices",
  "agreements",
  "webhooks",
  "operator",
  "exports",
  "growth"
] as const;

export const PlatformQueueNameV1Schema = z.enum(PLATFORM_QUEUE_NAMES_V1);

export type PlatformQueueNameV1 = z.infer<typeof PlatformQueueNameV1Schema>;

export const QueueJobCountBreakdownV1Schema = z
  .object({
    waiting: z.number().int().min(0),
    active: z.number().int().min(0),
    delayed: z.number().int().min(0),
    failed: z.number().int().min(0),
    paused: z.number().int().min(0),
    /** waiting + delayed + active — jobs not yet finished */
    backlog: z.number().int().min(0)
  })
  .strict();

export type QueueJobCountBreakdownV1 = z.infer<typeof QueueJobCountBreakdownV1Schema>;

export const QueueDeadLetterMetricsV1Schema = z
  .object({
    queueName: z.string().min(1).max(96),
    count: z.number().int().min(0),
    oldestJobAgeSeconds: z.number().int().min(0).nullable()
  })
  .strict();

export type QueueDeadLetterMetricsV1 = z.infer<typeof QueueDeadLetterMetricsV1Schema>;

export const PlatformQueueMetricsV1Schema = z
  .object({
    queueName: PlatformQueueNameV1Schema,
    counts: QueueJobCountBreakdownV1Schema,
    oldestJobAgeSeconds: z.number().int().min(0).nullable(),
    deadLetter: QueueDeadLetterMetricsV1Schema
  })
  .strict();

export type PlatformQueueMetricsV1 = z.infer<typeof PlatformQueueMetricsV1Schema>;

export const PlatformQueueMonitoringSnapshotV1Schema = z
  .object({
    contractVersion: z.literal(QUEUE_PLATFORM_CONTRACT_VERSION),
    collectedAt: z.string().datetime(),
    queues: z.array(PlatformQueueMetricsV1Schema).min(1)
  })
  .strict();

export type PlatformQueueMonitoringSnapshotV1 = z.infer<typeof PlatformQueueMonitoringSnapshotV1Schema>;
