/**
 * Growth — public marketing-site intake contracts (platform-level, NOT tenant-scoped).
 * POST /api/v1/public/marketing/demo-requests and POST /api/v1/public/marketing/growth-checks.
 */
import { z } from "zod";

/** Public lead classification only; this does not enable trade-specific app workflows. */
export const MARKETING_TRADES = [
  "hvac", "plumbing", "electrical", "appliance-repair", "garage-doors", "locksmith", "cleaning",
  "pest-control", "chimney", "pressure-washing", "tree-care", "alarm", "air-duct", "carpet-cleaning", "other"
] as const;
export const MarketingTradeSchema = z.enum(MARKETING_TRADES);
export type MarketingTrade = z.infer<typeof MarketingTradeSchema>;
export const MARKETING_TRADE_LABELS: Record<MarketingTrade, string> = {
  hvac: "HVAC & Refrigeration", plumbing: "Plumbing", electrical: "Electrical",
  "appliance-repair": "Appliance Repair", "garage-doors": "Overhead & Garage Door", locksmith: "Locksmith",
  cleaning: "Cleaning", "pest-control": "Pest Control", chimney: "Chimney", "pressure-washing": "Pressure Washing",
  "tree-care": "Tree Care", alarm: "Alarm", "air-duct": "Air Duct", "carpet-cleaning": "Carpet Cleaning", other: "Other home service"
};

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

export const MARKETING_TEAM_SIZES = ["Just me", "2–5", "6–15", "16–50", "50+"] as const;
export const MarketingLeadContactSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  phone: phoneSchema,
  company: z.string().trim().min(1).max(L.company),
  teamSize: z.enum(MARKETING_TEAM_SIZES)
}).strict();
export type MarketingLeadContact = z.output<typeof MarketingLeadContactSchema>;

const honeypotSchema = z.string().max(L.honeypot).optional();

export const MarketingDemoRequestBodySchema = z
  .object({
    name: z.string().trim().min(1).max(L.name),
    email: emailSchema,
    phone: z.union([phoneSchema, z.literal("").transform(() => undefined)]).optional(),
    company: z.string().trim().min(1).max(L.company),
    trade: MarketingTradeSchema,
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
    contact: MarketingLeadContactSchema.optional(),
    trade: MarketingTradeSchema,
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
