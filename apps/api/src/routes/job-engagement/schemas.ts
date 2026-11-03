import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();
const reviewChannelSchema = z.enum(["sms", "email"]);
const timeEntryTypeSchema = z.enum(["travel", "on_site", "break"]);

const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }]
} as const;

const nullableDateTimeSchema = {
  anyOf: [{ type: "string", format: "date-time" }, { type: "null" }]
} as const;

const nullableIntegerSchema = {
  anyOf: [{ type: "integer" }, { type: "null" }]
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
    durationMinutes: nullableIntegerSchema,
    entryType: { type: "string", enum: ["travel", "on_site", "break"] },
    notes: nullableStringSchema,
    travelFromAddress: nullableStringSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

const onTheWaySchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "companyId",
        "jobId",
        "technicianId",
        "customerId",
        "sentAt",
        "channel",
        "message",
        "estimatedArrivalMinutes",
        "technicianLat",
        "technicianLng",
        "createdAt",
        "updatedAt",
        "deletedAt"
      ],
      properties: {
        id: { type: "string" },
        companyId: { type: "string" },
        jobId: { type: "string" },
        technicianId: { type: "string" },
        customerId: { type: "string" },
        sentAt: nullableDateTimeSchema,
        channel: nullableStringSchema,
        message: nullableStringSchema,
        estimatedArrivalMinutes: nullableIntegerSchema,
        technicianLat: nullableStringSchema,
        technicianLng: nullableStringSchema,
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        deletedAt: nullableDateTimeSchema
      }
    },
    { type: "null" }
  ]
} as const;

const reviewRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "jobId",
    "customerId",
    "technicianId",
    "referenceId",
    "status",
    "channel",
    "reviewUrl",
    "sentAt",
    "clickedAt",
    "completedAt",
    "rating",
    "reviewText",
    "createdAt",
    "updatedAt",
    "deletedAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    jobId: nullableStringSchema,
    customerId: { type: "string" },
    technicianId: nullableStringSchema,
    referenceId: { type: "string" },
    status: { type: "string" },
    channel: { type: "string", enum: ["sms", "email"] },
    reviewUrl: nullableStringSchema,
    sentAt: nullableDateTimeSchema,
    clickedAt: nullableDateTimeSchema,
    completedAt: nullableDateTimeSchema,
    rating: {
      anyOf: [{ type: "integer" }, { type: "null" }]
    },
    reviewText: nullableStringSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    deletedAt: nullableDateTimeSchema
  }
} as const;

export const JobIdParamsSchema = z.object({ id: uuidSchema }).strict();

export const StartTimeEntrySchema = z
  .object({
    technicianId: uuidSchema.optional(),
    entryType: timeEntryTypeSchema.optional().default("on_site"),
    notes: z.string().trim().optional(),
    travelFromAddress: z.string().trim().optional()
  })
  .strict();

export const StopTimeEntrySchema = z
  .object({
    technicianId: uuidSchema.optional(),
    notes: z.string().trim().optional()
  })
  .strict();

export const OnTheWaySchema = z
  .object({
    technicianId: uuidSchema.optional(),
    estimatedArrivalMinutes: z.coerce.number().int().min(1).max(480).optional(),
    message: z.string().trim().optional(),
    technicianLat: z.coerce.number().min(-90).max(90).optional(),
    technicianLng: z.coerce.number().min(-180).max(180).optional()
  })
  .strict();

export const CreateReviewRequestSchema = z
  .object({
    channel: reviewChannelSchema.optional().default("sms")
  })
  .strict();

export type JobIdParams = z.infer<typeof JobIdParamsSchema>;
export type OnTheWayBody = z.infer<typeof OnTheWaySchema>;

export const jobIdValidation = withZodValidation({ params: JobIdParamsSchema });
export const startTimeEntryValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: StartTimeEntrySchema
});
export const stopTimeEntryValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: StopTimeEntrySchema
});
export const onTheWayValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: OnTheWaySchema
});
export const createReviewRequestValidation = withZodValidation({
  params: JobIdParamsSchema,
  body: CreateReviewRequestSchema
});

export const createTimeEntryRouteSchema = {
  tags: ["jobs"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["timeEntry"],
      properties: {
        timeEntry: timeEntrySchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const updateTimeEntryRouteSchema = {
  tags: ["jobs"],
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
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const listTimeEntriesRouteSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["timeEntries"],
      properties: {
        timeEntries: {
          type: "array",
          items: timeEntrySchema
        }
      }
    },
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const onTheWayRouteSchema = {
  tags: ["jobs"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["notification"],
      properties: {
        notification: onTheWaySchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const getOnTheWayRouteSchema = {
  tags: ["jobs"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["notification"],
      properties: {
        notification: onTheWaySchema
      }
    },
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const createReviewRequestRouteSchema = {
  tags: ["review-requests"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["reviewRequest"],
      properties: {
        reviewRequest: reviewRequestSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;
