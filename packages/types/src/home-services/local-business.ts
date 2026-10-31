/**
 * Growth (home services): schema.org LocalBusiness JSON-LD + Google Business Profile category mapping.
 * Pure data/builders; plug-in registries keyed by trade (later trades just add entries).
 */

export type HomeServiceTradeKey = "hvac" | "plumbing" | "electrical" | "other";

/** schema.org @type per trade. Unknown/unset trade falls back to `other`. */
export const SCHEMA_ORG_TRADE_TYPE_REGISTRY: Record<string, { schemaType: string }> = {
  hvac: { schemaType: "HVACBusiness" },
  plumbing: { schemaType: "Plumber" },
  electrical: { schemaType: "Electrician" },
  other: { schemaType: "HomeAndConstructionBusiness" }
};

function own<T>(registry: Record<string, T>, key: unknown): T | undefined {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(registry, key) ? registry[key] : undefined;
}

export function schemaOrgTypeForTrade(trade: string | null | undefined): string {
  const entry = own(SCHEMA_ORG_TRADE_TYPE_REGISTRY, trade);
  return (entry ?? SCHEMA_ORG_TRADE_TYPE_REGISTRY.other!).schemaType;
}

/**
 * Google Business Profile categories per trade (display names as shown in GBP; gcid ids intentionally omitted).
 * Data only: the GBP sync adapter stays disabled ("not_configured") until Google OAuth keys are provided.
 */
export interface GbpCategoryMapping {
  primary: string;
  secondary: string[];
}

export const GBP_TRADE_CATEGORY_REGISTRY: Record<string, GbpCategoryMapping> = {
  hvac: {
    primary: "HVAC contractor",
    secondary: ["Air conditioning contractor", "Heating contractor", "Air conditioning repair service", "Furnace repair service"]
  },
  plumbing: { primary: "Plumber", secondary: ["Drainage service", "Water heater installation service", "Septic system service"] },
  electrical: { primary: "Electrician", secondary: ["Electrical installation service", "Lighting contractor"] },
  other: { primary: "Contractor", secondary: ["Handyman/Handywoman/Handyperson", "General contractor"] }
};

export const GBP_ADAPTER_STATUS = "not_configured" as const;

export function getGbpCategoriesForTrade(trade: string | null | undefined): GbpCategoryMapping & {
  trade: string;
  adapterStatus: typeof GBP_ADAPTER_STATUS;
} {
  const key = own(GBP_TRADE_CATEGORY_REGISTRY, trade) ? (trade as string) : "other";
  const mapping = GBP_TRADE_CATEGORY_REGISTRY[key]!;
  return { trade: key, primary: mapping.primary, secondary: [...mapping.secondary], adapterStatus: GBP_ADAPTER_STATUS };
}

/** Max PostalCode entries in areaServed (keeps the embedded script small). */
export const LOCAL_BUSINESS_MAX_AREA_ZIPS = 50;

const DAY_MAP: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday"
};
const ALL_DAYS = Object.values(DAY_MAP);

/** http(s) absolute URL only; returns normalized href or null. */
export function sanitizePublicUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 2000) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function hourString(hour: number): string | null {
  if (!Number.isInteger(hour) || hour < 0 || hour > 24) return null;
  return hour === 24 ? "23:59" : `${String(hour).padStart(2, "0")}:00`;
}

export interface LocalBusinessInput {
  name: string;
  trade: string | null | undefined;
  url: string | null | undefined;
  telephone: string | null | undefined;
  logoUrl?: string | null;
  address?: { city?: string | null; state?: string | null; zip?: string | null } | null;
  areaServedZips: string[];
  availableDays: string[];
  availableHoursStart: number | null;
  availableHoursEnd: number | null;
  /** Only true when the shop's emergency service is enabled and accepted for its trade. */
  emergency24x7: boolean;
  sameAs: Array<string | null | undefined>;
}

export function buildLocalBusinessJsonLd(input: LocalBusinessInput): Record<string, unknown> {
  const out: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaOrgTypeForTrade(input.trade),
    name: input.name
  };
  const url = sanitizePublicUrl(input.url);
  if (url) out.url = url;
  const phone = typeof input.telephone === "string" ? input.telephone.trim() : "";
  if (phone && /^[0-9+().\-\s]{7,30}$/u.test(phone)) out.telephone = phone;
  const logo = sanitizePublicUrl(input.logoUrl);
  if (logo) out.logo = logo;
  const address = input.address;
  if (address && (address.city || address.state || address.zip)) {
    // Locality only: no street address (many home-service shops run from a home).
    out.address = {
      "@type": "PostalAddress",
      ...(address.city ? { addressLocality: address.city } : {}),
      ...(address.state ? { addressRegion: address.state } : {}),
      ...(address.zip ? { postalCode: address.zip } : {}),
      addressCountry: "US"
    };
  }
  const zips = Array.from(new Set(input.areaServedZips.filter((zip) => /^\d{5}$/u.test(zip)))).sort();
  if (zips.length > 0) {
    out.areaServed = zips.slice(0, LOCAL_BUSINESS_MAX_AREA_ZIPS).map((postalCode) => ({ "@type": "PostalCode", postalCode }));
  }
  const hours: Array<Record<string, unknown>> = [];
  if (input.emergency24x7) {
    hours.push({ "@type": "OpeningHoursSpecification", dayOfWeek: ALL_DAYS, opens: "00:00", closes: "23:59" });
  } else {
    const days = input.availableDays.map((day) => own(DAY_MAP, day.toLowerCase())).filter((day): day is string => Boolean(day));
    const opens = input.availableHoursStart === null ? null : hourString(input.availableHoursStart);
    const closes = input.availableHoursEnd === null ? null : hourString(input.availableHoursEnd);
    if (days.length > 0 && opens && closes) {
      hours.push({ "@type": "OpeningHoursSpecification", dayOfWeek: Array.from(new Set(days)), opens, closes });
    }
  }
  if (hours.length > 0) out.openingHoursSpecification = hours;
  const sameAs = Array.from(new Set(input.sameAs.map(sanitizePublicUrl).filter((value): value is string => Boolean(value))));
  if (sameAs.length > 0) out.sameAs = sameAs;
  return out;
}

/**
 * Serialize JSON-LD for embedding in `<script type="application/ld+json">`: escapes <, >, & and U+2028/U+2029
 * so hostile strings (e.g. `</script><img onerror=...>`) cannot break out of the script element.
 */
export function serializeJsonLdForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</gu, "\\u003c")
    .replace(/>/gu, "\\u003e")
    .replace(/&/gu, "\\u0026")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
}
