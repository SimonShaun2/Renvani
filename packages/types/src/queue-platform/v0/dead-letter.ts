import { z } from "zod";

import { UuidSchema } from "../../agent-control-plane/v1/zod-shared.js";

import { QUEUE_PLATFORM_CONTRACT_VERSION } from "./constants.js";
import { PlatformQueueNameV1Schema } from "./monitoring.js";
import { JobFailureClassV1Schema } from "./retry-policy.js";

export const DeadLetterJobEnvelopeV1Schema = z
  .object({
    contractVersion: z.literal(QUEUE_PLATFORM_CONTRACT_VERSION),
    sourceQueue: z.string().min(1).max(64),
    sourceJobId: z.string().min(1).max(128),
    jobName: z.string().min(1).max(128),
    companyId: UuidSchema.optional(),
    payload: z.record(z.string(), z.unknown()),
    attemptsMade: z.number().int().min(0),
    failedAt: z.string().datetime(),
    failureClass: JobFailureClassV1Schema,
    errorMessage: z.string().min(1).max(4_000)
  })
  .strict();

export type DeadLetterJobEnvelopeV1 = z.infer<typeof DeadLetterJobEnvelopeV1Schema>;

export const DeadLetterRecoveryRequestV1Schema = z
  .object({
    contractVersion: z.literal(QUEUE_PLATFORM_CONTRACT_VERSION),
    sourceQueue: PlatformQueueNameV1Schema,
    deadLetterJobId: z.string().min(1).max(128),
    requestedByUserId: UuidSchema.optional()
  })
  .strict();

export type DeadLetterRecoveryRequestV1 = z.infer<typeof DeadLetterRecoveryRequestV1Schema>;
