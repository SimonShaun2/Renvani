import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

// FS-60 recurring series controls. All bodies are strict.
const seriesParams = z.object({ seriesId: z.string().uuid() }).strict();
const reason = z.string().trim().min(1).max(500);
const occurrenceId = z.string().uuid();
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");

export const seriesChangeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause"), reason }).strict(),
  z.object({ action: z.literal("resume"), reason }).strict(),
  z.object({ action: z.literal("end"), reason }).strict(),
  z.object({ action: z.literal("skip_occurrence"), occurrenceId, reason }).strict(),
  z.object({ action: z.literal("reschedule_occurrence"), occurrenceId, localDate, reason }).strict(),
  z.object({ action: z.literal("reschedule_future"), localTime, reason }).strict()
]);

export const previewBodySchema = z.object({ change: seriesChangeSchema }).strict();

export const executeBodySchema = z
  .object({
    expectedVersion: z.number().int().min(1).max(1_000_000),
    idempotencyKey: z.string().trim().min(8).max(128),
    previewHash: z.string().regex(/^[a-f0-9]{64}$/),
    change: seriesChangeSchema
  })
  .strict();

export type SeriesParams = z.infer<typeof seriesParams>;

export const getSeriesValidation = withZodValidation({ params: seriesParams, query: z.object({}).strict() });
export const previewSeriesChangeValidation = withZodValidation({ params: seriesParams, body: previewBodySchema });
export const executeSeriesChangeValidation = withZodValidation({ params: seriesParams, body: executeBodySchema });
