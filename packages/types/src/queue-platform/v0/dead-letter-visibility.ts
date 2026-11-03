import { z } from "zod";

import { UuidSchema } from "../../agent-control-plane/v1/zod-shared.js";

import { QUEUE_PLATFORM_CONTRACT_VERSION } from "./constants.js";
import { JobFailureClassV1Schema } from "./retry-policy.js";
import { PlatformQueueNameV1Schema } from "./monitoring.js";

export const DeadLetterJobSummaryV1Schema = z
  .object({
    deadLetterJobId: z.string().min(1).max(128),
    sourceQueue: PlatformQueueNameV1Schema,
    sourceJobId: z.string().min(1).max(128),
    jobName: z.string().min(1).max(128),
    companyId: UuidSchema.optional(),
    attemptsMade: z.number().int().min(0),
    failedAt: z.string().datetime(),
    failureClass: JobFailureClassV1Schema,
    errorMessage: z.string().min(1).max(4_000)
  })
  .strict();

export type DeadLetterJobSummaryV1 = z.infer<typeof DeadLetterJobSummaryV1Schema>;

export const DeadLetterJobListV1Schema = z
  .object({
    contractVersion: z.literal(QUEUE_PLATFORM_CONTRACT_VERSION),
    sourceQueue: PlatformQueueNameV1Schema,
    deadLetterQueueName: z.string().min(1).max(96),
    jobs: z.array(DeadLetterJobSummaryV1Schema),
    nextCursor: z.string().min(1).max(128).nullable()
  })
  .strict();

export type DeadLetterJobListV1 = z.infer<typeof DeadLetterJobListV1Schema>;
