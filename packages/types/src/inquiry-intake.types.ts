import { z } from "zod";

import type { BookingSource } from "./booking-request.types.js";

export const INQUIRY_INTAKE_CONTRACT_VERSION = "inquiry-intake@v0.1";

export const inquiryIntakeChannelSchema = z.enum([
  "web_form",
  "staff_entry",
  "imported",
  "adapter"
]);

export type InquiryIntakeChannel = z.infer<typeof inquiryIntakeChannelSchema>;

export const inquiryAttributionProvenanceSchema = z.enum([
  "query_param",
  "adapter_signed",
  "staff_entry",
  "unknown"
]);

export type InquiryAttributionProvenance = z.infer<typeof inquiryAttributionProvenanceSchema>;

export const classifiedInquiryIntentSchema = z.enum(["book", "quote", "question", "unknown"]);

export type ClassifiedInquiryIntent = z.infer<typeof classifiedInquiryIntentSchema>;

export const inquiryServiceabilitySchema = z.enum(["in_area", "out_of_area", "unknown"]);

export type InquiryServiceability = z.infer<typeof inquiryServiceabilitySchema>;

export const inquiryIntakeStatusSchema = z.enum([
  "open",
  "qualified",
  "escalated",
  "converted",
  "closed"
]);

export type InquiryIntakeStatus = z.infer<typeof inquiryIntakeStatusSchema>;

export const inquiryIntakeContactSchema = z.object({
  phone: z.string().min(7).max(30),
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100)
});

export const inquiryIntakePropertySchema = z.object({
  zip: z.string().min(3).max(20),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  addressLine1: z.string().min(1).max(255)
});

export const inquiryIntakeConsentSchema = z.object({
  smsAppointments: z.boolean(),
  smsMarketing: z.boolean(),
  capturedAt: z.string().datetime(),
  captureSurface: z.string().min(1).max(120)
});

export const inquiryIntakeV1Schema = z.object({
  contractVersion: z.literal(INQUIRY_INTAKE_CONTRACT_VERSION),
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  channel: inquiryIntakeChannelSchema,
  sourceAttribution: z.string().nullable(),
  attributionProvenance: inquiryAttributionProvenanceSchema,
  contact: inquiryIntakeContactSchema,
  property: inquiryIntakePropertySchema.optional(),
  intentText: z.string(),
  classifiedIntent: classifiedInquiryIntentSchema.optional(),
  serviceability: inquiryServiceabilitySchema,
  consent: inquiryIntakeConsentSchema,
  status: inquiryIntakeStatusSchema,
  linkedBookingRequestId: z.string().uuid().optional(),
  linkedCustomerId: z.string().uuid().optional(),
  dedupeKey: z.string().optional(),
  escalationReason: z.string().optional()
});

export type InquiryIntakeV1 = z.infer<typeof inquiryIntakeV1Schema>;

export const staffInquiryIntakeInputSchema = z.object({
  channel: z.enum(["staff_entry", "adapter"]),
  sourceAttribution: z.enum([
    "google",
    "facebook",
    "instagram",
    "yelp",
    "direct",
    "website",
    "qr_code"
  ] as [BookingSource, ...BookingSource[]]).optional(),
  attributionProvenance: inquiryAttributionProvenanceSchema.optional(),
  contact: inquiryIntakeContactSchema,
  property: inquiryIntakePropertySchema.partial().optional(),
  intentText: z.string().min(1).max(8000),
  smsConsentAppointments: z.boolean().optional(),
  smsConsentMarketing: z.boolean().optional()
});

export type StaffInquiryIntakeInput = z.infer<typeof staffInquiryIntakeInputSchema>;

export const inboxInquiryIntakeInputSchema = z.object({
  inboxChannel: z.enum(["email", "sms"]),
  externalMessageId: z.string().min(1).max(256),
  fromAddress: z.string().min(3).max(320),
  subject: z.string().max(500).optional(),
  bodyText: z.string().min(1).max(16000),
  receivedAt: z.string().datetime().optional(),
  adapterAttribution: z
    .enum(["google", "facebook", "instagram", "yelp", "direct", "website", "qr_code"] as [
      BookingSource,
      ...BookingSource[]
    ])
    .optional(),
  adapterAttributionVerified: z.boolean().optional()
});

export type InboxInquiryIntakeInput = z.infer<typeof inboxInquiryIntakeInputSchema>;

export const publicInquirySubmitResultSchema = z.object({
  bookingRequest: z.object({
    id: z.string().uuid(),
    referenceNumber: z.string().nullable(),
    status: z.string()
  }),
  confirmation: z.unknown(),
  holdToken: z.string().nullable(),
  inquiry: inquiryIntakeV1Schema,
  /** Present when the request carried `emergency: true`; `downgraded` means the shop has emergency service off. */
  emergency: z
    .object({ requested: z.boolean(), accepted: z.boolean(), downgraded: z.boolean() })
    .optional()
});

export type PublicInquirySubmitResult = z.infer<typeof publicInquirySubmitResultSchema>;
