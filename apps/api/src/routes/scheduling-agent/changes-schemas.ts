import { z } from "zod";

import { SCHEDULE_EXCEPTION_KINDS } from "../../services/scheduling-changes.service.js";
import { withZodValidation } from "../shared/validation.js";

// FS-24 schedule changes and exceptions. All bodies are strict.
const jobParams = z.object({ jobId: z.string().uuid() }).strict();
const expectedVersion = z.number().int().min(1).max(1_000_000);
const idempotencyKey = z.string().trim().min(8).max(128);
const reason = z.string().trim().min(1).max(500);

export const rescheduleBodySchema = z
  .object({
    expectedVersion,
    idempotencyKey,
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    technicianId: z.string().uuid().optional(),
    reason
  })
  .strict();

export const cancelBodySchema = z.object({ expectedVersion, idempotencyKey, reason }).strict();

export const exceptionBodySchema = z
  .object({
    expectedVersion,
    idempotencyKey,
    kind: z.enum(SCHEDULE_EXCEPTION_KINDS),
    note: z.string().trim().min(1).max(1000),
    delayMinutes: z.number().int().min(1).max(480).optional()
  })
  .strict();

export type JobScheduleParams = z.infer<typeof jobParams>;

export const getJobScheduleValidation = withZodValidation({ params: jobParams, query: z.object({}).strict() });
export const rescheduleJobValidation = withZodValidation({ params: jobParams, body: rescheduleBodySchema });
export const cancelJobValidation = withZodValidation({ params: jobParams, body: cancelBodySchema });
export const scheduleExceptionValidation = withZodValidation({ params: jobParams, body: exceptionBodySchema });
