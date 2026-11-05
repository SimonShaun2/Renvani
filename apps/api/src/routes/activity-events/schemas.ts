import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const uuidSchema = z.string().uuid();

const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }]
} as const;

const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message", "requestId"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" },
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

const activityEventSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "companyId",
    "eventType",
    "actorId",
    "actorType",
    "actorName",
    "entityType",
    "entityId",
    "customerId",
    "jobId",
    "estimateId",
    "invoiceId",
    "payload",
    "summary",
    "occurredAt"
  ],
  properties: {
    id: { type: "string" },
    companyId: { type: "string" },
    eventType: { type: "string" },
    actorId: nullableStringSchema,
    actorType: nullableStringSchema,
    actorName: nullableStringSchema,
    entityType: { type: "string" },
    entityId: { type: "string" },
    customerId: nullableStringSchema,
    jobId: nullableStringSchema,
    estimateId: nullableStringSchema,
    invoiceId: nullableStringSchema,
    payload: {},
    summary: { type: "string" },
    occurredAt: { type: "string", format: "date-time" }
  }
} as const;

export const ListActivityEventsQuerySchema = z
  .object({
    entityType: z.string().trim().min(1).optional(),
    entityId: uuidSchema.optional(),
    customerId: uuidSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.customerId && !(value.entityType && value.entityId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customerId or entityType + entityId is required"
      });
    }

    if ((value.entityType && !value.entityId) || (!value.entityType && value.entityId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "entityType and entityId must be provided together"
      });
    }
  });

export type ListActivityEventsQueryInput = z.infer<typeof ListActivityEventsQuerySchema>;

export const listActivityEventsValidation = withZodValidation({
  query: ListActivityEventsQuerySchema
});

export const listActivityEventsRouteSchema = {
  tags: ["activity-events"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["data", "total", "page", "limit", "totalPages"],
      properties: {
        data: {
          type: "array",
          items: activityEventSchema
        },
        total: { type: "integer" },
        page: { type: "integer" },
        limit: { type: "integer" },
        totalPages: { type: "integer" }
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema
  }
} as const;
