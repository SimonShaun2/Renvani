import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();
const dateTimeSchema = z.string().datetime({ offset: true });

const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }]
} as const;

const nullableDateTimeSchema = {
  anyOf: [{ type: "string", format: "date-time" }, { type: "null" }]
} as const;

const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message", "requestId"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" },
    reason: { type: "string" },
    current: {},
    fields: {
      anyOf: [
        {
          type: "object",
          additionalProperties: { type: "string" }
        },
        { type: "null" }
      ]
    }
  }
} as const;

const timeEntrySchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "jobId",
    "technicianId",
    "startedAt",
    "endedAt",
    "durationMinutes",
    "entryType",
    "notes",
    "travelFromAddress",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    jobId: { type: "string" },
    technicianId: { type: "string" },
    startedAt: { type: "string", format: "date-time" },
    endedAt: nullableDateTimeSchema,
    durationMinutes: {
      anyOf: [{ type: "integer" }, { type: "null" }]
    },
    entryType: { type: "string", enum: ["travel", "on_site", "break"] },
    notes: nullableStringSchema,
    travelFromAddress: nullableStringSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

function buildUpdateSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .strict()
    .refine((input) => Object.keys(input).length > 0, {
      message: "At least one field is required"
    });
}

export const TimeEntryIdParamsSchema = z.object({ entryId: uuidSchema }).strict();

export const UpdateTimeEntrySchema = buildUpdateSchema({
  startedAt: dateTimeSchema.optional(),
  endedAt: z.union([dateTimeSchema, z.null()]).optional(),
  entryType: z.enum(["travel", "on_site", "break"]).optional(),
  notes: z.string().trim().optional(),
  travelFromAddress: z.string().trim().optional()
});

export type TimeEntryIdParams = z.infer<typeof TimeEntryIdParamsSchema>;

export const updateTimeEntryValidation = withZodValidation({
  params: TimeEntryIdParamsSchema,
  body: UpdateTimeEntrySchema
});

export const updateTimeEntryRouteSchema = {
  tags: ["time"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["timeEntry"],
      properties: {
        timeEntry: timeEntrySchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;
