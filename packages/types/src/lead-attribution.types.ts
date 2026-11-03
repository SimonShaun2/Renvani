import { z } from "zod";

/**
 * Growth (source tracking): marketing attribution captured on public booking/inquiry and carried to the job.
 * Registry-driven whitelist: unknown keys are dropped, values are trimmed, length-limited and charset-restricted
 * so no URLs, query strings, emails or free text (PII) can be stored. Invalid values are dropped, never rejected,
 * so attribution can never block a booking.
 */
export const LEAD_ATTRIBUTION_FIELDS = {
  utm_source: { maxLength: 64, kind: "token" },
  utm_medium: { maxLength: 64, kind: "token" },
  utm_campaign: { maxLength: 100, kind: "token" },
  utm_content: { maxLength: 100, kind: "token" },
  utm_term: { maxLength: 100, kind: "token" },
  referrer_host: { maxLength: 253, kind: "host" },
  link_id: { maxLength: 64, kind: "id" },
  ad_id: { maxLength: 64, kind: "id" }
} as const satisfies Record<string, { maxLength: number; kind: "token" | "host" | "id" }>;

export type LeadAttributionKey = keyof typeof LEAD_ATTRIBUTION_FIELDS;
export type LeadAttribution = Partial<Record<LeadAttributionKey, string>>;

/** Letters, digits, space and `._~+-` only: rejects `@` (emails), `/ : ? = &` (URLs/query strings), markup. */
const TOKEN_PATTERN = /^[\p{L}\p{N} ._~+-]+$/u;
const ID_PATTERN = /^[A-Za-z0-9._~-]+$/u;
const HOST_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$/u;
/** A value that is mostly a phone number is PII, not a campaign name. */
const PHONE_LIKE_PATTERN = /^[+\d][\d ().-]{6,}$/u;

/** Referrer may arrive as a full URL; keep only the host (no path, query or credentials). */
function toReferrerHost(raw: string): string | null {
  let host = raw.trim().toLowerCase();
  if (/^https?:\/\//u.test(host)) {
    try {
      const url = new URL(host);
      if (url.username || url.password) return null;
      host = url.hostname;
    } catch {
      return null;
    }
  }
  host = host.replace(/^www\./u, "").replace(/\.$/u, "");
  return HOST_PATTERN.test(host) ? host : null;
}

function sanitizeValue(key: LeadAttributionKey, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const field = LEAD_ATTRIBUTION_FIELDS[key];
  if (field.kind === "host") {
    const host = toReferrerHost(raw);
    return host && host.length <= field.maxLength ? host : null;
  }
  const value = raw.trim().replace(/\s+/gu, " ");
  if (value.length === 0 || value.length > field.maxLength) return null;
  if (field.kind === "id") return ID_PATTERN.test(value) ? value : null;
  if (!TOKEN_PATTERN.test(value) || PHONE_LIKE_PATTERN.test(value)) return null;
  return value.toLowerCase();
}

/** Returns only whitelisted, valid fields, or null when nothing usable remains. */
export function sanitizeLeadAttribution(input: unknown): LeadAttribution | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const result: LeadAttribution = {};
  for (const key of Object.keys(LEAD_ATTRIBUTION_FIELDS) as LeadAttributionKey[]) {
    const value = sanitizeValue(key, (input as Record<string, unknown>)[key]);
    if (value !== null) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Optional request field: any shape in, sanitized attribution (or undefined) out. */
export const leadAttributionInputSchema = z
  .unknown()
  .optional()
  .transform((value) => sanitizeLeadAttribution(value) ?? undefined);

/** Reporting key for "Direct demand": utm_source, else referrer host, else "direct". */
export function leadAttributionSourceKey(attribution: LeadAttribution | null | undefined): string {
  return attribution?.utm_source ?? attribution?.referrer_host ?? "direct";
}

export interface DirectDemandSourceSummary {
  source: string;
  jobCount: number;
  paidRevenue: string;
}

export interface DirectDemandSummary {
  period: { startDate: string; endDate: string; timeZone: string };
  totals: { jobCount: number; paidRevenue: string };
  sources: DirectDemandSourceSummary[];
}
