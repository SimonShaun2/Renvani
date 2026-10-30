import type { PublicBookingSettingsRecord } from "@/src/hooks/booking.hooks";

/** Trade registry for the public shop site: metadata + schema.org @type per trade. Add a trade = add one entry. */
export interface SiteTradeConfig {
  key: string;
  label: string;
  schemaType: string;
  keywords: string[];
  /** Lower-case words that identify this trade in offered service labels (until the API exposes the trade). */
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
  cleaning: {
    key: "cleaning",
    label: "Residential cleaning",
    schemaType: "HomeAndConstructionBusiness",
    keywords: ["residential cleaning", "house cleaning", "book cleaning online"],
    match: ["clean", "maid", "move-in", "move-out"]
  },
  default: {
    key: "default",
    label: "Home services",
    schemaType: "LocalBusiness",
    keywords: ["home services", "local service", "book online"],
    match: []
  }
} as const satisfies Record<string, SiteTradeConfig>;

export type SiteTradeKey = keyof typeof SITE_TRADES;

function serviceText(settings: Pick<PublicBookingSettingsRecord, "offeredServices">): string {
  return settings.offeredServices
    .flatMap((s) => [s.label, s.name, s.category, ...(Array.isArray(s.types) ? s.types : [])])
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();
}

/**
 * Resolves the trade: an explicit `trade`/`industry` field if the API ever sends one, otherwise the trade whose
 * words appear most in the offered services, otherwise `default` (never assumes cleaning).
 */
export function resolveSiteTrade(settings: Pick<PublicBookingSettingsRecord, "offeredServices">): SiteTradeConfig {
  const explicit = (settings as { trade?: unknown; industry?: unknown }).trade ?? (settings as { industry?: unknown }).industry;
  if (typeof explicit === "string" && explicit.toLowerCase() in SITE_TRADES) {
    return SITE_TRADES[explicit.toLowerCase() as SiteTradeKey];
  }
  const text = ` ${serviceText(settings)} `;
  let best: SiteTradeConfig = SITE_TRADES.default;
  let bestScore = 0;
  for (const trade of Object.values(SITE_TRADES)) {
    const score = trade.match.filter((word) => text.includes(word)).length;
    if (score > bestScore) {
      best = trade;
      bestScore = score;
    }
  }
  return best;
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
export function buildSiteMetadataCopy(settings: Pick<PublicBookingSettingsRecord, "companyName" | "tagline" | "offeredServices">) {
  const trade = resolveSiteTrade(settings);
  const title = `${settings.companyName} · ${trade.label}`;
  const description =
    settings.tagline ?? `${settings.companyName}: ${trade.label.toLowerCase()}. Book online or send a direct inquiry.`;
  return { trade, title, description, keywords: [settings.companyName, ...trade.keywords] };
}
