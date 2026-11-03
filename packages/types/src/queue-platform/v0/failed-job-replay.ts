import { z } from "zod";

import { UuidSchema } from "../../agent-control-plane/v1/zod-shared.js";

import { QUEUE_PLATFORM_CONTRACT_VERSION } from "./constants.js";
import { PlatformQueueNameV1Schema } from "./monitoring.js";

export const FailedJobReplayMetadataV1Schema = z
  .object({
    jobId: z.string().min(1).max(128),
    queueName: PlatformQueueNameV1Schema,
    jobName: z.string().min(1).max(128),
    companyId: UuidSchema,
    attemptsMade: z.number().int().min(0),
    failedAt: z.string().datetime().nullable(),
    failedReason: z.string().max(4_000).nullable(),
    replayable: z.literal(true)
  })
  .strict();

export type FailedJobReplayMetadataV1 = z.infer<typeof FailedJobReplayMetadataV1Schema>;

export const FailedJobReplayListV1Schema = z
  .object({
    contractVersion: z.literal(QUEUE_PLATFORM_CONTRACT_VERSION),
    sourceQueue: PlatformQueueNameV1Schema,
    companyId: UuidSchema,
    jobs: z.array(FailedJobReplayMetadataV1Schema),
    nextCursor: z.string().min(1).max(128).nullable()
  })
  .strict();

export type FailedJobReplayListV1 = z.infer<typeof FailedJobReplayListV1Schema>;
