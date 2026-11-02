import { z } from "zod";

import { withZodValidation } from "../shared/validation.js";

const notificationPreferenceSchema = z
  .object({
    email: z.boolean().optional(),
    sms: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one notification channel is required"
  });

const companyNotificationSettingsSchema = z
  .object({
    bookingRequest: notificationPreferenceSchema.nullable().optional(),
    estimateFollowUp: notificationPreferenceSchema.nullable().optional(),
    invoiceRecovery: notificationPreferenceSchema.nullable().optional(),
    paymentReceived: notificationPreferenceSchema.nullable().optional(),
    reviewRequest: notificationPreferenceSchema.nullable().optional(),
    serviceDueAlert: notificationPreferenceSchema.nullable().optional()
  })
  .strict();

const companySettingsSchema = z
  .object({
    tradingName: z.string().trim().min(1).nullable().optional(),
    currency: z.string().trim().length(3).nullable().optional(),
    notifications: companyNotificationSettingsSchema.optional(),
    invoicing: z
      .object({ defaultPaymentTermsDays: z.number().int().min(0).max(365).nullable().optional() })
      .strict()
      .optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one company setting is required"
  });

const nullableStringSchema = {
  anyOf: [{ type: "string" }, { type: "null" }]
} as const;

const companyResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "slug",
    "phone",
    "email",
    "website",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "zip",
    "timezone",
    "logoUrl",
    "settings",
    "createdAt"
  ],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    slug: { type: "string" },
    phone: nullableStringSchema,
    email: nullableStringSchema,
    website: nullableStringSchema,
    addressLine1: nullableStringSchema,
    addressLine2: nullableStringSchema,
    city: nullableStringSchema,
    state: nullableStringSchema,
    zip: nullableStringSchema,
    timezone: { type: "string" },
    logoUrl: nullableStringSchema,
    settings: {
      type: "object",
      additionalProperties: true,
      properties: {
        tradingName: nullableStringSchema,
        currency: nullableStringSchema,
        notifications: {
          type: "object",
          additionalProperties: false,
          properties: {
            bookingRequest: {
              type: "object",
              additionalProperties: false,
              properties: {
                email: { type: "boolean" },
                sms: { type: "boolean" }
              }
            },
            estimateFollowUp: {
              type: "object",
              additionalProperties: false,
              properties: {
                email: { type: "boolean" },
                sms: { type: "boolean" }
              }
            },
            invoiceRecovery: {
              type: "object",
              additionalProperties: false,
              properties: {
                email: { type: "boolean" },
                sms: { type: "boolean" }
              }
            },
            paymentReceived: {
              type: "object",
              additionalProperties: false,
              properties: {
                email: { type: "boolean" },
                sms: { type: "boolean" }
              }
            },
            reviewRequest: {
              type: "object",
              additionalProperties: false,
              properties: {
                email: { type: "boolean" },
                sms: { type: "boolean" }
              }
            },
            serviceDueAlert: {
              type: "object",
              additionalProperties: false,
              properties: {
                email: { type: "boolean" },
                sms: { type: "boolean" }
              }
            }
          }
        }
      }
    },
    createdAt: { type: "string", format: "date-time" }
  }
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

export const UpdateCompanySchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    phone: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    website: z.string().trim().url().optional(),
    addressLine1: z.string().trim().min(1).optional(),
    addressLine2: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    zip: z.string().trim().min(1).optional(),
    timezone: z.string().trim().min(1).optional(),
    logoUrl: z.string().trim().url().optional(),
    settings: companySettingsSchema.optional()
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one field is required"
  });

export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>;

export const updateCompanyValidation = withZodValidation({ body: UpdateCompanySchema });

export const getCompanyRouteSchema = {
  tags: ["company"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["company"],
      properties: {
        company: companyResponseSchema
      }
    },
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const updateCompanyRouteSchema = {
  tags: ["company"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["company"],
      properties: {
        company: companyResponseSchema
      }
    },
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;
