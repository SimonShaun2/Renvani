import { z } from "zod";

import { withZodValidation } from "../../shared/validation.js";

const uuidSchema = z.string().uuid();

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
    requestId: { type: "string" }
  }
} as const;

export const ReviewTokenParamsSchema = z.object({
  token: uuidSchema
}).strict();

export const ReviewCompleteSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  reviewText: z.string().trim().optional()
}).strict();

export type ReviewTokenParams = z.infer<typeof ReviewTokenParamsSchema>;
export type ReviewCompleteBody = z.infer<typeof ReviewCompleteSchema>;

export const reviewTokenValidation = withZodValidation({
  params: ReviewTokenParamsSchema
});
export const reviewCompleteValidation = withZodValidation({
  params: ReviewTokenParamsSchema,
  body: ReviewCompleteSchema
});

export const publicReviewRouteSchema = {
  tags: ["public-reviews"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["review"],
      properties: {
        review: {
          type: "object",
          additionalProperties: false,
          required: [
            "reviewRequestId",
            "companyName",
            "technicianName",
            "status",
            "reviewUrl",
            "expiresAt",
            "settings",
            "reviewLinks"
          ],
          properties: {
            reviewRequestId: { type: "string" },
            companyName: { type: "string" },
            technicianName: nullableStringSchema,
            status: { type: "string" },
            reviewUrl: nullableStringSchema,
            expiresAt: nullableDateTimeSchema,
            settings: {
              type: "object",
              additionalProperties: false,
              required: ["google", "yelp", "facebook"],
              properties: {
                google: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label", "url", "isActive"],
                  properties: {
                    label: { type: "string" },
                    url: nullableStringSchema,
                    isActive: { type: "boolean" }
                  }
                },
                yelp: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label", "url", "isActive"],
                  properties: {
                    label: { type: "string" },
                    url: nullableStringSchema,
                    isActive: { type: "boolean" }
                  }
                },
                facebook: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label", "url", "isActive"],
                  properties: {
                    label: { type: "string" },
                    url: nullableStringSchema,
                    isActive: { type: "boolean" }
                  }
                }
              }
            },
            reviewLinks: {
              type: "object",
              additionalProperties: false,
              required: ["google", "yelp", "facebook"],
              properties: {
                google: nullableStringSchema,
                yelp: nullableStringSchema,
                facebook: nullableStringSchema
              }
            }
          }
        }
      }
    },
    404: errorResponseSchema
  }
} as const;

export const completeReviewRouteSchema = {
  tags: ["public-reviews"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["reviewRequest"],
      properties: {
        reviewRequest: {
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
            channel: { type: "string" },
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
        },
        routing: {
          type: "object",
          additionalProperties: false,
          required: ["kind"],
          properties: {
            kind: { type: "string", enum: ["public_review", "private_feedback"] },
            platform: { type: "string", enum: ["google"] },
            url: { type: "string" }
          }
        }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;
