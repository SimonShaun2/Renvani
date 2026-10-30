import { z } from "zod";

import { withZodValidation } from "../../shared/validation.js";

const bookingSourceSchema = z.enum(["google", "facebook", "instagram", "yelp", "direct", "website", "qr_code"]);
const slugSchema = z.string().trim().min(1).max(100);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

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
      type: "object",
      additionalProperties: { type: "string" }
    }
  }
} as const;

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export const BookingSlugParamsSchema = z.object({
  slug: slugSchema
}).strict();

export const BookingConfirmationParamsSchema = z.object({
  slug: slugSchema,
  ref: z.string().trim().min(1)
}).strict();

const uuidSchema = z.string().uuid();

export const PublicHoldBookingSlotSchema = z.object({
  holdToken: z.string().trim().min(1),
  technicianId: uuidSchema,
  scheduledStart: z.string().datetime({ offset: true }),
  scheduledEnd: z.string().datetime({ offset: true })
}).strict();

export const PublicConfirmBookingSlotSchema = z.object({
  technicianId: uuidSchema,
  scheduledStart: z.string().datetime({ offset: true }),
  scheduledEnd: z.string().datetime({ offset: true })
}).strict();

export const PublicInspectHoldTokenSchema = z
  .object({
    holdToken: z.string().trim().min(1)
  })
  .strict();

export const ZipCheckSchema = z.object({
  zip: z.string().trim().min(1)
}).strict();

export const EmailCaptureSchema = z.object({
  zip: z.string().trim().min(1),
  email: z.string().trim().email()
}).strict();

export const PublicAvailabilityQuerySchema = z.object({
  zip: z.string().trim().min(1),
  date: z.string().regex(isoDatePattern).refine(isValidIsoDate, "Invalid ISO date").optional()
}).strict();

export const SubmitBookingRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  addressLine1: z.string().trim().min(1),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  zip: z.string().trim().min(1),
  propertyType: z.string().trim().optional(),
  serviceCategory: z.string().trim().optional(),
  serviceType: z.string().trim().optional(),
  serviceDetail: z.string().trim().optional(),
  urgency: z.enum(["emergency", "this_week", "flexible"]).optional(),
  customerNotes: z.string().trim().optional(),
  preferredDate: z.string().regex(isoDatePattern).refine(isValidIsoDate, "Invalid ISO date").optional(),
  preferredWindow: z.enum(["morning", "afternoon", "first_available"]).optional(),
  isPropertyOwner: z.boolean().optional(),
  smsConsentAppointments: z.boolean().optional(),
  smsConsentMarketing: z.boolean().optional()
}).strict();

export const BookingSubmitQuerySchema = z.object({
  src: bookingSourceSchema.optional()
}).strict();

export type BookingSlugParams = z.infer<typeof BookingSlugParamsSchema>;
export type BookingConfirmationParams = z.infer<typeof BookingConfirmationParamsSchema>;
export type PublicAvailabilityQuery = z.infer<typeof PublicAvailabilityQuerySchema>;
export type BookingSubmitQuery = z.infer<typeof BookingSubmitQuerySchema>;
export type ZipCheckBody = z.infer<typeof ZipCheckSchema>;

export const bookingSlugValidation = withZodValidation({
  params: BookingSlugParamsSchema
});
export const bookingConfirmationValidation = withZodValidation({
  params: BookingConfirmationParamsSchema
});
export const zipCheckValidation = withZodValidation({
  params: BookingSlugParamsSchema,
  body: ZipCheckSchema
});
export const emailCaptureValidation = withZodValidation({
  params: BookingSlugParamsSchema,
  body: EmailCaptureSchema
});
export const availabilityValidation = withZodValidation({
  params: BookingSlugParamsSchema,
  query: PublicAvailabilityQuerySchema
});
export const submitBookingValidation = withZodValidation({
  params: BookingSlugParamsSchema,
  query: BookingSubmitQuerySchema,
  body: SubmitBookingRequestSchema
});
export const publicHoldBookingSlotValidation = withZodValidation({
  params: BookingConfirmationParamsSchema,
  body: PublicHoldBookingSlotSchema
});

export const publicConfirmBookingSlotValidation = withZodValidation({
  params: BookingConfirmationParamsSchema,
  body: PublicConfirmBookingSlotSchema
});

export const publicInspectHoldTokenValidation = withZodValidation({
  params: BookingSlugParamsSchema,
  body: PublicInspectHoldTokenSchema
});

export const publicBookingRouteSchema = {
  tags: ["public-booking"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["booking"],
      properties: {
        booking: {
          type: "object",
          additionalProperties: false,
          required: [
            "companyName",
            "companySlug",
            "bookingSlug",
            "offeredServices",
            "availableHoursStart",
            "availableHoursEnd",
            "availableDays",
            "slotDuration",
            "maxAdvanceDays",
            "googleReviewUrl",
            "yelpReviewUrl",
            "facebookReviewUrl",
            "phone",
            "logoUrl",
            "serviceAreaZipCodes",
            "serviceAreaNames",
            "timezone"
          ],
          properties: {
            companyName: { type: "string" },
            companySlug: { type: "string" },
            bookingSlug: { type: "string" },
            offeredServices: { type: "array", items: { type: "object", additionalProperties: true } },
            availableHoursStart: { type: "integer" },
            availableHoursEnd: { type: "integer" },
            availableDays: { type: "array", items: { type: "string" } },
            slotDuration: { type: "integer" },
            maxAdvanceDays: { type: "integer" },
            googleReviewUrl: nullableStringSchema,
            yelpReviewUrl: nullableStringSchema,
            facebookReviewUrl: nullableStringSchema,
            phone: nullableStringSchema,
            logoUrl: nullableStringSchema,
            serviceAreaZipCodes: { type: "array", items: { type: "string" } },
            serviceAreaNames: { type: "array", items: { type: "string" } },
            timezone: { type: "string" }
          }
        }
      }
    },
    404: errorResponseSchema
  }
} as const;

export const emailCaptureRouteSchema = {
  tags: ["public-booking"],
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
    404: errorResponseSchema
  }
} as const;

export const zipCheckRouteSchema = {
  tags: ["public-booking"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["covered", "techCount"],
      properties: {
        covered: { type: "boolean" },
        techCount: { type: "integer" }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const availabilityRouteSchema = {
  tags: ["public-booking"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["availability"],
      properties: {
        availability: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["date", "window", "start", "end", "technicianIds"],
            properties: {
              date: { type: "string" },
              window: { type: "string" },
              start: { type: "string", format: "date-time" },
              end: { type: "string", format: "date-time" },
              technicianIds: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema
  }
} as const;

export const submitBookingRouteSchema = {
  tags: ["public-booking"],
  response: {
    201: {
      type: "object",
      additionalProperties: false,
      required: ["bookingRequest", "confirmation", "holdToken"],
      properties: {
        bookingRequest: {
          type: "object",
          additionalProperties: false,
          required: ["id", "referenceNumber", "status"],
          properties: {
            id: { type: "string" },
            referenceNumber: nullableStringSchema,
            status: { type: "string" }
          }
        },
        holdToken: { anyOf: [{ type: "string" }, { type: "null" }] },
        confirmation: {
          type: "object",
          additionalProperties: false,
          required: ["referenceNumber", "status", "companyName", "scheduledStart", "scheduledEnd"],
          properties: {
            referenceNumber: { type: "string" },
            status: { type: "string" },
            companyName: { type: "string" },
            scheduledStart: nullableStringSchema,
            scheduledEnd: nullableStringSchema
          }
        }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema,
    429: errorResponseSchema
  }
} as const;

export const bookingConfirmationRouteSchema = {
  tags: ["public-booking"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["confirmation"],
      properties: {
        confirmation: {
          type: "object",
          additionalProperties: false,
          required: ["referenceNumber", "status", "companyName", "scheduledStart", "scheduledEnd"],
          properties: {
            referenceNumber: { type: "string" },
            status: { type: "string" },
            companyName: { type: "string" },
            scheduledStart: nullableStringSchema,
            scheduledEnd: nullableStringSchema
          }
        }
      }
    },
    404: errorResponseSchema
  }
} as const;

export const publicInspectHoldTokenRouteSchema = {
  tags: ["public-booking"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["inspection"],
      properties: {
        inspection: {
          type: "object",
          additionalProperties: false,
          required: ["status", "referenceNumber", "bookingRequestId", "companyId", "expiresAt", "slugMatches"],
          properties: {
            status: { type: "string", enum: ["valid", "expired", "invalid"] },
            referenceNumber: { anyOf: [{ type: "string" }, { type: "null" }] },
            bookingRequestId: { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] },
            companyId: { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] },
            expiresAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
            slugMatches: { type: "boolean" }
          }
        }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
    429: errorResponseSchema
  }
} as const;

export const publicConfirmBookingSlotRouteSchema = {
  tags: ["public-booking"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["bookingRequest", "jobId", "recurringSchedule"],
      properties: {
        bookingRequest: {
          type: "object",
          additionalProperties: false,
          required: ["id", "referenceNumber", "status", "jobId"],
          properties: {
            id: { type: "string" },
            referenceNumber: nullableStringSchema,
            status: { type: "string" },
            jobId: { type: "string" }
          }
        },
        jobId: { type: "string" },
        recurringSchedule: {
          type: "object",
          additionalProperties: false,
          required: ["linked", "scheduleKind", "maintenancePlanId", "maintenanceVisitId"],
          properties: {
            linked: { type: "boolean" },
            scheduleKind: { type: "string", enum: ["vip", "maintenance", "none"] },
            maintenancePlanId: { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] },
            maintenanceVisitId: { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] }
          }
        }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema,
    429: errorResponseSchema
  }
} as const;

export const publicSlotHoldRouteSchema = {
  tags: ["public-booking"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["bookingRequest", "hold"],
      properties: {
        bookingRequest: {
          type: "object",
          additionalProperties: false,
          required: ["id", "referenceNumber", "status", "assignedTechnicianId"],
          properties: {
            id: { type: "string" },
            referenceNumber: nullableStringSchema,
            status: { type: "string" },
            assignedTechnicianId: { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] }
          }
        },
        hold: {
          type: "object",
          additionalProperties: false,
          required: ["technicianId", "scheduledStart", "scheduledEnd"],
          properties: {
            technicianId: { type: "string", format: "uuid" },
            scheduledStart: { type: "string", format: "date-time" },
            scheduledEnd: { type: "string", format: "date-time" }
          }
        }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema,
    429: errorResponseSchema
  }
} as const;
