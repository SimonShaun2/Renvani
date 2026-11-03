/**
 * Service-page inquiry (Figma 155:79 "Ask a question" card), built to the Dev C contract (#268):
 * POST /api/v1/public/site/{slug}/inquiry. Until that endpoint is on dev, pages use the existing booking-submit path
 * (`BrandedInquiryClient`). Flip with SITE_INQUIRY_API_ENABLED="true" (server env) once #268 is deployed.
 */
export type SiteInquiryMode = "inquiry-api" | "booking-submit";

export function resolveSiteInquiryMode(env: NodeJS.ProcessEnv = process.env): SiteInquiryMode {
  return env.SITE_INQUIRY_API_ENABLED === "true" ? "inquiry-api" : "booking-submit";
}

export const INQUIRY_FIELDS = ["name", "phone", "email", "message"] as const;
export type InquiryField = (typeof INQUIRY_FIELDS)[number];
export type InquiryFieldErrors = Partial<Record<InquiryField, string>>;

export interface SiteInquiryInput {
  name: string;
  phone: string;
  email: string;
  message: string;
  service: string;
  zip: string;
}

export type SiteInquiryResult =
  | { kind: "sent"; referenceNumber: string }
  | { kind: "invalid"; fieldErrors: InquiryFieldErrors; formError: string | null }
  | { kind: "rate_limited"; retryAfterSeconds: number | null }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side checks mirroring the contract's messages, so the frame's per-field error state shows before a round-trip. */
export function validateSiteInquiry(input: Pick<SiteInquiryInput, "name" | "phone" | "email">): InquiryFieldErrors {
  const errors: InquiryFieldErrors = {};
  if (!input.name.trim()) errors.name = "Name is required";
  const digits = input.phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (!input.phone.trim()) errors.phone = "Phone is required";
  else if (digits.length !== 10) errors.phone = "Enter a valid 10-digit US phone number";
  if (input.email.trim() && !EMAIL.test(input.email.trim())) errors.email = "Enter a valid email address";
  return errors;
}

export async function submitSiteInquiry(
  slug: string,
  input: SiteInquiryInput,
  fetchImpl: typeof fetch = fetch
): Promise<SiteInquiryResult> {
  const body = {
    name: input.name.trim(),
    phone: input.phone.trim(),
    zip: input.zip.trim(),
    ...(input.email.trim() ? { email: input.email.trim() } : {}),
    ...(input.message.trim() ? { message: input.message.trim() } : {}),
    ...(input.service.trim() ? { service: input.service.trim() } : {}),
    // Honeypot: real users never fill it, so the client always sends it empty.
    website: ""
  };
  let response: Response;
  try {
    response = await fetchImpl(`/api/v1/public/site/${encodeURIComponent(slug)}/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    return { kind: "error", message: "We could not send your inquiry. Please try again." };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    inquiry?: { referenceNumber?: string };
    message?: string;
    errors?: Array<{ field?: string; message?: string }>;
  };
  if (response.status === 201 || response.ok) {
    return { kind: "sent", referenceNumber: payload.inquiry?.referenceNumber ?? "" };
  }
  if (response.status === 429) {
    const retry = Number(response.headers.get("Retry-After"));
    return { kind: "rate_limited", retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : null };
  }
  if (response.status === 404) return { kind: "not_found" };
  if (response.status === 400) {
    const fieldErrors: InquiryFieldErrors = {};
    const other: string[] = [];
    for (const e of payload.errors ?? []) {
      if (!e.message) continue;
      if ((INQUIRY_FIELDS as readonly string[]).includes(e.field ?? "")) fieldErrors[e.field as InquiryField] ??= e.message;
      else other.push(e.message); // zip/service/body are not visible fields on this card
    }
    return { kind: "invalid", fieldErrors, formError: other[0] ?? (Object.keys(fieldErrors).length ? null : payload.message ?? null) };
  }
  return { kind: "error", message: payload.message ?? "We could not send your inquiry. Please try again." };
}

export function rateLimitMessage(retryAfterSeconds: number | null): string {
  if (!retryAfterSeconds) return "Too many inquiries. Please try again later.";
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Too many inquiries. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
