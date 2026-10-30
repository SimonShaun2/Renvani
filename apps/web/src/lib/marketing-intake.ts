import { z } from "zod";

import { API_BASE_URL } from "@/src/lib/api-base-url";

/**
 * Marketing intake contract (PR #328, Dev A).
 * TODO(#328): once #328 lands in dev, delete these local copies and import
 * MarketingDemoRequestBodySchema, MarketingGrowthCheckBodySchema, MARKETING_HONEYPOT_FIELD and HOME_SERVICE_TRADES
 * from "@fsm/types".
 */
export const MARKETING_HONEYPOT_FIELD = "hp" as const;
export const HOME_SERVICE_TRADES = ["hvac", "plumbing", "electrical", "other"] as const;
export const TRADE_LABELS: Record<(typeof HOME_SERVICE_TRADES)[number], string> = { hvac: "HVAC", plumbing: "Plumbing", electrical: "Electrical", other: "Other home service" };

const trade = z.enum(HOME_SERVICE_TRADES, { errorMap: () => ({ message: "Choose your trade." }) });
const email = z.string().trim().min(1, "Enter your email.").max(254, "Use 254 characters or fewer.").email("Enter a valid email.");
const hp = z.string().max(0);

export const MarketingDemoRequestBodySchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(120, "Use 120 characters or fewer."),
    email,
    phone: z.string().regex(/^\d{10}$/, "Enter a 10-digit US phone number.").optional(),
    company: z.string().trim().min(1, "Enter your business name.").max(160, "Use 160 characters or fewer."),
    trade,
    message: z.string().max(2000, "Use 2,000 characters or fewer.").optional(),
    hp
  })
  .strict();

export const MarketingGrowthCheckBodySchema = z
  .object({
    websiteUrl: z
      .string()
      .trim()
      .max(2048, "Use a shorter website address.")
      .refine((v) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v), "Enter your website, like yourbusiness.com."),
    trade,
    zip: z.string().regex(/^\d{5}$/, "Enter a 5-digit ZIP.").optional(),
    city: z.string().trim().min(1).max(100, "Use 100 characters or fewer.").optional(),
    email,
    hp
  })
  .strict()
  .refine((v) => Boolean(v.zip || v.city), { message: "Enter your ZIP or city.", path: ["location"] });

export type MarketingDemoRequestBody = z.infer<typeof MarketingDemoRequestBodySchema>;
export type MarketingGrowthCheckBody = z.infer<typeof MarketingGrowthCheckBodySchema>;
export type MarketingIntakeResponse = { ok: true; confirmationId: string };

export type IntakeKind = "demo-requests" | "growth-checks";

export type IntakeResult =
  | { status: "success"; confirmationId: string }
  | { status: "invalid"; fields: Record<string, string>; message: string }
  | { status: "rate-limited"; retryAfterSeconds: number | null; message: string }
  | { status: "error"; message: string };

export const INTAKE_MESSAGES = {
  invalid: "Check the highlighted fields.",
  tooLarge: "That request is too long. Shorten it and try again.",
  rateLimited: "Too many requests. Please wait a moment and try again.",
  error: "Something went wrong on our side. Please try again."
} as const;

/** Adds https:// when the visitor types a bare domain ("yourbusiness.com"). */
export function normalizeWebsite(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** Splits the single "ZIP or city" input into the contract's zip / city fields. */
export function splitLocation(raw: string): { zip?: string; city?: string } {
  const v = raw.trim();
  if (!v) return {};
  return /^\d{5}$/.test(v) ? { zip: v } : { city: v };
}

export function fieldErrors(issues: z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    out[key] ??= i.message;
  }
  return out;
}

function mapApiFields(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const msg = Array.isArray(v) ? v[0] : v;
    out[k === "zip" || k === "city" ? "location" : k] = typeof msg === "string" && msg ? msg : "Check this field.";
  }
  return out;
}

/**
 * Server-side POST to the API (the API's CORS only allows the app origins, so the browser never calls it).
 * Never logs the body: it carries names and emails.
 */
export async function postMarketingIntake(kind: IntakeKind, body: MarketingDemoRequestBody | MarketingGrowthCheckBody, fetchImpl: typeof fetch = fetch, baseUrl: string = API_BASE_URL): Promise<IntakeResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}/api/v1/public/marketing/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
  } catch {
    console.error(`[marketing-intake] ${kind}: network error`);
    return { status: "error", message: INTAKE_MESSAGES.error };
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 201 || (res.ok && json?.ok === true)) {
    return { status: "success", confirmationId: typeof json?.confirmationId === "string" ? json.confirmationId : "" };
  }
  if (res.status === 400) {
    const err = (json?.error ?? json) as Record<string, unknown> | null;
    return { status: "invalid", fields: mapApiFields(err?.fields ?? json?.fields), message: INTAKE_MESSAGES.invalid };
  }
  if (res.status === 413) return { status: "error", message: INTAKE_MESSAGES.tooLarge };
  if (res.status === 429) {
    const ra = Number(res.headers.get("Retry-After"));
    return { status: "rate-limited", retryAfterSeconds: Number.isFinite(ra) && ra > 0 ? ra : null, message: INTAKE_MESSAGES.rateLimited };
  }
  console.error(`[marketing-intake] ${kind}: API status ${res.status}`);
  return { status: "error", message: INTAKE_MESSAGES.error };
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

export function demoBodyFromForm(fd: FormData) {
  const teamSize = str(fd, "teamSize").trim();
  const raw = {
    name: str(fd, "name").trim(),
    email: str(fd, "email").trim(),
    company: str(fd, "company").trim(),
    trade: str(fd, "trade"),
    ...(teamSize ? { message: `Team size: ${teamSize}` } : {}),
    hp: str(fd, MARKETING_HONEYPOT_FIELD)
  };
  return MarketingDemoRequestBodySchema.safeParse(raw);
}

export function growthBodyFromForm(fd: FormData) {
  const raw = {
    websiteUrl: normalizeWebsite(str(fd, "websiteUrl")),
    trade: str(fd, "trade"),
    ...splitLocation(str(fd, "location")),
    email: str(fd, "email").trim(),
    hp: str(fd, MARKETING_HONEYPOT_FIELD)
  };
  return MarketingGrowthCheckBodySchema.safeParse(raw);
}

/** Shared action body. A filled honeypot gets a quiet fake success and never reaches the API. */
export async function runIntake(kind: IntakeKind, fd: FormData, fetchImpl?: typeof fetch): Promise<IntakeResult> {
  if (str(fd, MARKETING_HONEYPOT_FIELD) !== "") return { status: "success", confirmationId: "" };
  const parsed = kind === "demo-requests" ? demoBodyFromForm(fd) : growthBodyFromForm(fd);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error.issues);
    // zod skips the object-level ZIP/city refine when a field already failed; report it together.
    if (kind === "growth-checks" && !str(fd, "location").trim()) fields.location ??= "Enter your ZIP or city.";
    return { status: "invalid", fields, message: INTAKE_MESSAGES.invalid };
  }
  return postMarketingIntake(kind, parsed.data, fetchImpl);
}
