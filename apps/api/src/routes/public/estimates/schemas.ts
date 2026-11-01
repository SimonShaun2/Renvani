import { z } from "zod";

import { withZodValidation } from "../../shared/validation.js";

const tokenSchema = z.string().min(32);

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

const publicEstimateItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "quantity", "unitPrice", "total"],
  properties: {
    name: { type: "string" },
    description: nullableStringSchema,
    quantity: { type: "string" },
    unitPrice: { type: "string" },
    total: { type: "string" }
  }
} as const;

const publicEstimateTierSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "estimateNumber",
    "title",
    "tierLabel",
    "subtotal",
    "taxRate",
    "taxAmount",
    "discountAmount",
    "total",
    "items"
  ],
  properties: {
    estimateNumber: { type: "string" },
    title: nullableStringSchema,
    tierLabel: nullableStringSchema,
    subtotal: { type: "string" },
    taxRate: nullableStringSchema,
    taxAmount: nullableStringSchema,
    discountAmount: nullableStringSchema,
    total: { type: "string" },
    recommended: { type: "boolean" },
    items: {
      type: "array",
      items: publicEstimateItemSchema
    }
  }
} as const;

/** FS-212: only sent when a financing provider is ready (never while financing is disabled). */
const publicEstimateFinancingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["offered", "provider", "providerReady", "monthlyFrom"],
  properties: {
    offered: { type: "boolean" },
    provider: { type: "string" },
    providerReady: { type: "boolean" },
    monthlyFrom: nullableStringSchema,
    reason: { type: "string" }
  }
} as const;

const publicEstimateSchedulingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["companyName", "bookingSlug", "zip", "customer", "property"],
  properties: {
    companyName: { type: "string" },
    bookingSlug: { type: "string" },
    zip: { type: "string" },
    customer: {
      type: "object",
      additionalProperties: false,
      required: ["firstName", "lastName", "phone", "email"],
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        phone: { type: "string" },
        email: nullableStringSchema
      }
    },
    property: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["addressLine1", "addressLine2", "city", "state", "zip"],
          properties: {
            addressLine1: { type: "string" },
            addressLine2: nullableStringSchema,
            city: { type: "string" },
            state: { type: "string" },
            zip: { type: "string" }
          }
        },
        { type: "null" }
      ]
    }
  }
} as const;

const publicEstimateSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "estimateNumber",
    "title",
    "status",
    "messageToCustomer",
    "subtotal",
    "taxRate",
    "taxAmount",
    "discountAmount",
    "total",
    "financingOffered",
    "tierLabel",
    "expiresAt",
    "tiers",
    "items"
  ],
  properties: {
    estimateNumber: { type: "string" },
    title: nullableStringSchema,
    status: { type: "string" },
    messageToCustomer: nullableStringSchema,
    subtotal: { type: "string" },
    taxRate: nullableStringSchema,
    taxAmount: nullableStringSchema,
    discountAmount: nullableStringSchema,
    total: { type: "string" },
    financingOffered: {
      anyOf: [{ type: "boolean" }, { type: "null" }]
    },
    tierLabel: nullableStringSchema,
    expiresAt: nullableDateTimeSchema,
    financing: publicEstimateFinancingSchema,
    tiers: {
      anyOf: [
        {
          type: "array",
          items: publicEstimateTierSchema
        },
        { type: "null" }
      ]
    },
    items: {
      type: "array",
      items: publicEstimateItemSchema
    }
  }
} as const;

export const TokenParamsSchema = z
  .object({
    token: tokenSchema
  })
  .strict();

export const CustomerApproveSchema = z
  .object({
    approvedByName: z.string().trim().min(1).max(255),
    signatureUrl: z.string().trim().url().optional(),
    selectedEstimateNumber: z.string().trim().min(1).max(64).optional()
  })
  .strict();

export const CustomerDeclineSchema = z
  .object({
    reason: z.string().trim().optional()
  })
  .strict();

export type TokenParams = z.infer<typeof TokenParamsSchema>;
export type CustomerApproveBody = z.infer<typeof CustomerApproveSchema>;
export type CustomerDeclineBody = z.infer<typeof CustomerDeclineSchema>;

export const publicEstimateValidation = withZodValidation({ params: TokenParamsSchema });
export const customerApproveValidation = withZodValidation({
  params: TokenParamsSchema,
  body: CustomerApproveSchema
});
export const customerDeclineValidation = withZodValidation({
  params: TokenParamsSchema,
  body: CustomerDeclineSchema
});

export const getPublicEstimateSchema = {
  tags: ["public-estimates"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["estimate", "scheduling"],
      properties: {
        estimate: publicEstimateSchema,
        scheduling: {
          anyOf: [publicEstimateSchedulingSchema, { type: "null" }]
        }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema,
    429: errorResponseSchema
  }
} as const;

export const publicEstimateActionSchema = {
  tags: ["public-estimates"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["success"],
      properties: {
        success: { type: "boolean" }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema,
    429: errorResponseSchema
  }
} as const;
