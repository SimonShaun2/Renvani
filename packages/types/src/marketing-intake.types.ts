/**
 * Growth — public marketing-site intake contracts (platform-level, NOT tenant-scoped).
 * POST /api/v1/public/marketing/demo-requests and POST /api/v1/public/marketing/growth-checks.
 */
import { z } from "zod";

import { HomeServiceTradeSchema } from "./home-services/trade.js";

/** Honeypot field: real users never fill it (hide it with CSS). When non-empty the API returns the normal success shape and persists nothing. */
export const MARKETING_HONEYPOT_FIELD = "hp" as const;

export const MARKETING_INTAKE_STATUSES = ["new", "contacted", "qualified", "closed", "spam"] as const;
export type MarketingIntakeStatus = (typeof MARKETING_INTAKE_STATUSES)[number];

export const MARKETING_INTAKE_LIMITS = {
  name: 120,
  email: 254,
  company: 160,
  message: 2000,
  phoneMaxInput: 32,
  websiteUrl: 2048,
  city: 100,
  honeypot: 500
} as const;

const L = MARKETING_INTAKE_LIMITS;

const emailSchema = z.string().trim().toLowerCase().min(3).max(L.email).email();

/** US/NANP phone: 10 digits (optional leading 1) after stripping punctuation; normalized to "+1XXXXXXXXXX". */
const phoneSchema = z
  .string()
  .trim()
  .max(L.phoneMaxInput)
  .refine((v) => /^[0-9+().\-\s]*$/.test(v), "Invalid phone number")
  .transform((v) => v.replace(/\D/g, ""))
  .refine((d) => d.length === 10 || (d.length === 11 && d.startsWith("1")), "Invalid phone number")
  .transform((d) => `+1${d.slice(-10)}`);

const honeypotSchema = z.string().max(L.honeypot).optional();

export const MarketingDemoRequestBodySchema = z
  .object({
    name: z.string().trim().min(1).max(L.name),
    email: emailSchema,
    phone: z.union([phoneSchema, z.literal("").transform(() => undefined)]).optional(),
    company: z.string().trim().min(1).max(L.company),
    trade: HomeServiceTradeSchema,
    message: z.string().trim().max(L.message).optional(),
    hp: honeypotSchema
  })
  .strict();
export type MarketingDemoRequestBody = z.input<typeof MarketingDemoRequestBodySchema>;
export type MarketingDemoRequestInput = z.output<typeof MarketingDemoRequestBodySchema>;

const websiteUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(L.websiteUrl)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.length > 0 && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Website URL must be an http(s) URL");

export const MarketingGrowthCheckBodySchema = z
  .object({
    websiteUrl: websiteUrlSchema,
    trade: HomeServiceTradeSchema,
    zip: z.string().trim().regex(/^\d{5}$/, "ZIP must be 5 digits").optional(),
    city: z.string().trim().min(1).max(L.city).optional(),
    email: emailSchema,
    hp: honeypotSchema
  })
  .strict()
  .refine((b) => Boolean(b.zip || b.city), { message: "zip or city is required", path: ["zip"] });
export type MarketingGrowthCheckBody = z.input<typeof MarketingGrowthCheckBodySchema>;
export type MarketingGrowthCheckInput = z.output<typeof MarketingGrowthCheckBodySchema>;

/** Success response for both endpoints (201). Identical shape for honeypot hits and duplicates; input is never echoed. */
export interface MarketingIntakeResponse {
  ok: true;
  confirmationId: string;
}
