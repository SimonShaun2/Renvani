import { z } from "zod";

import { MigrateFileBatchJobProgressSchema } from "./migrate-file-batch-progress.js";

export const MigrateFileBatchOperatorStatusV1Schema = z.object({
  importSessionId: z.string().uuid(),
  batchIndex: z.number().int().nonnegative(),
  queueJobId: z.string().min(1).max(128).nullable(),
  queueState: z.string().min(1).max(32).nullable(),
  progress: MigrateFileBatchJobProgressSchema.nullable(),
  retryAvailable: z.boolean()
});

export type MigrateFileBatchOperatorStatusV1 = z.infer<typeof MigrateFileBatchOperatorStatusV1Schema>;

export const MigrateFileBatchOperatorRetryResultV1Schema = z.object({
  importSessionId: z.string().uuid(),
  batchIndex: z.number().int().nonnegative(),
  enqueuedQueueJobId: z.string().min(1).max(128),
  idempotencyKey: z.string().min(1).max(256)
});

export type MigrateFileBatchOperatorRetryResultV1 = z.infer<
  typeof MigrateFileBatchOperatorRetryResultV1Schema
>;
