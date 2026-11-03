import { z } from "zod";

export const webAssistantTopicSchema = z.enum([
  "services", "service_area", "booking_hours", "emergency", "contact",
  "availability", "pricing", "human", "other"
]);

export const webAssistantHandoffReasonSchema = z.enum([
  "human_requested", "out_of_area", "unknown_serviceability", "unsupported_service",
  "emergency_review", "pricing_review", "availability_review", "unverified_answer"
]);

const zipSchema = z.string().regex(/^\d{5}(?:-\d{4})?$/u, "Enter a valid US ZIP code").transform((zip) => zip.slice(0, 5));
const optionalService = z.string().trim().min(1).max(100).optional();

const answerRequestSchema = z.object({
  action: z.literal("answer"),
  topic: webAssistantTopicSchema,
  service: optionalService,
  zip: zipSchema.optional()
}).strict();

const handoffRequestSchema = z.object({
  action: z.literal("handoff"),
  topic: webAssistantTopicSchema,
  service: optionalService,
  message: z.string().trim().min(1).max(2000),
  contact: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().max(100),
    phone: z.string().trim().min(7).max(30),
    email: z.string().trim().email().max(255).optional(),
    addressLine1: z.string().trim().min(1).max(255),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().regex(/^[A-Za-z]{2}$/u, "Enter a two-letter state"),
    zip: zipSchema
  }).strict(),
  contactConsent: z.literal(true),
  smsConsentAppointments: z.boolean().optional(),
  smsConsentMarketing: z.boolean().optional(),
  source: z.enum(["google", "facebook", "instagram", "yelp", "direct", "website", "qr_code"]).optional()
}).strict();

export const webAssistantRequestSchema = z.discriminatedUnion("action", [answerRequestSchema, handoffRequestSchema]);
export type WebAssistantRequest = z.infer<typeof webAssistantRequestSchema>;

export const webAssistantResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("answer"),
    verified: z.boolean(),
    answer: z.string(),
    source: z.enum(["public_booking_settings", "zip_serviceability", "unverified"])
  }).strict(),
  z.object({
    kind: z.literal("handoff"),
    status: z.literal("pending"),
    referenceNumber: z.string(),
    reason: webAssistantHandoffReasonSchema,
    message: z.literal("Your request is pending staff review. No appointment has been confirmed.")
  }).strict()
]);
export type WebAssistantResponse = z.infer<typeof webAssistantResponseSchema>;
export type WebAssistantHandoffReason = z.infer<typeof webAssistantHandoffReasonSchema>;
