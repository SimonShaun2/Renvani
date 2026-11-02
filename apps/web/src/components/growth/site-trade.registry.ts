import type { PublicBookingSettingsRecord } from "@/src/hooks/booking.hooks";

/** Trade registry (hvac | plumbing | electrical | other) for the public shop site: metadata + schema.org @type per trade. Add a trade = add one entry. */
export interface SiteTradeConfig {
  key: string;
  label: string;
  schemaType: string;
  keywords: string[];
  /** Legacy keywords retained for registry compatibility; never infer the shop's trade from service labels. */
  match: string[];
}

export const SITE_TRADES = {
  hvac: {
    key: "hvac",
    label: "Heating & air conditioning",
    schemaType: "HVACBusiness",
    keywords: ["HVAC", "AC repair", "furnace repair", "heating and cooling"],
    match: ["hvac", "furnace", "air condition", "a/c", "ac ", "heat pump", "duct", "tune-up"]
  },
  plumbing: {
    key: "plumbing",
    label: "Plumbing",
    schemaType: "Plumber",
    keywords: ["plumber", "plumbing repair", "drain cleaning", "water heater"],
    match: ["plumb", "drain", "water heater", "pipe", "leak", "sewer", "toilet"]
  },
  electrical: {
    key: "electrical",
    label: "Electrical",
    schemaType: "Electrician",
    keywords: ["electrician", "electrical repair", "panel upgrade", "wiring"],
    match: ["electric", "wiring", "panel", "outlet", "breaker", "ev charger"]
  },
  /** Any other home-services shop; also the fallback for an unknown or missing trade. */
  other: {
    key: "other",
    label: "Home services",
    schemaType: "HomeAndConstructionBusiness",
    keywords: ["home services", "home repair", "book online"],
    match: []
  }
} as const satisfies Record<string, SiteTradeConfig>;

export type SiteTradeKey = keyof typeof SITE_TRADES;

/**
 * Resolves only the configured company trade; service labels are not proof of shop identity.
 */
export function resolveSiteTrade(settings: Pick<PublicBookingSettingsRecord, "trade">): SiteTradeConfig {
  return settings.trade && Object.hasOwn(SITE_TRADES, settings.trade)
    ? SITE_TRADES[settings.trade]
    : SITE_TRADES.other;
}

const DAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday"
};

function hour(value: number): string {
  return `${String(Math.max(0, Math.min(24, Math.trunc(value)))).padStart(2, "0")}:00`;
}

/** schema.org openingHoursSpecification from the public booking hours (booking window = advertised hours). */
export function buildOpeningHours(
  settings: Pick<PublicBookingSettingsRecord, "availableDays" | "availableHoursStart" | "availableHoursEnd">
) {
  const days = settings.availableDays
    .map((d) => DAY_NAMES[d.toLowerCase().slice(0, 3)])
    .filter((d): d is string => Boolean(d));
  if (days.length === 0 || settings.availableHoursEnd <= settings.availableHoursStart) return undefined;
  return [
    {
      "@type": "OpeningHoursSpecification" as const,
      dayOfWeek: days,
      opens: hour(settings.availableHoursStart),
      closes: hour(settings.availableHoursEnd)
    }
  ];
}

/** Trade-correct title, description and keywords for /site/[slug]. */
export function buildSiteMetadataCopy(settings: Pick<PublicBookingSettingsRecord, "companyName" | "tagline" | "trade">) {
  const trade = settings.trade && Object.hasOwn(SITE_TRADES, settings.trade)
    ? SITE_TRADES[settings.trade]
    : SITE_TRADES.other;
  const title = `${settings.companyName} · ${trade.label}`;
  const description =
    settings.tagline ?? `${settings.companyName}: ${trade.label.toLowerCase()}. Review available services or send a direct inquiry.`;
  return { trade, title, description, keywords: [settings.companyName, ...trade.keywords] };
}
