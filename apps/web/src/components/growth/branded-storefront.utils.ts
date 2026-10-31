import { buildOpeningHours, type SiteTradeConfig } from "@/src/components/growth/site-trade.registry";
import type { PublicBookingSettingsRecord } from "@/src/hooks/booking.hooks";

export interface BrandedServiceCard {
  id: string;
  title: string;
  subtitle: string;
}

export interface BrandedReviewLink {
  label: string;
  href: string;
}

/** Query `src` for branded acquisition pages → `booking_requests.source` + FS-22 `own_website`. */
export const BRANDED_ACQUISITION_SOURCE = "website";

export interface BrandedStorefrontViewModel {
  companyName: string;
  bookingSlug: string;
  tagline: string;
  phone: string | null;
  logoUrl: string | null;
  serviceCards: BrandedServiceCard[];
  serviceAreaSummary: string;
  serviceAreaZips: string[];
  /** Staff preview status line only — never fabricated ratings on the public site. */
  trustLine: string | null;
  reviewLinks: BrandedReviewLink[];
}

export interface LocalBusinessJsonLd {
  "@context": "https://schema.org";
  "@type": string;
  name: string;
  description: string;
  url: string;
  telephone?: string;
  areaServed: string[];
  openingHoursSpecification?: ReturnType<typeof buildOpeningHours>;
  aggregateRating?: { "@type": "AggregateRating"; ratingValue: number; reviewCount: number };
}

/** Generic home-services cards (HVAC, plumbing, electrical) shown until the shop lists its services. */
const HOME_SERVICES_FALLBACK_CARDS: BrandedServiceCard[] = [
  { id: "hvac", title: "Heating & cooling repair", subtitle: "Diagnostic visit" },
  { id: "plumbing", title: "Plumbing repair", subtitle: "Diagnostic visit" },
  { id: "electrical", title: "Electrical repair", subtitle: "Diagnostic visit" },
  { id: "tune-up", title: "Seasonal tune-up", subtitle: "Tune-up visit" }
];

function readServiceLabel(service: Record<string, unknown>): string | null {
  if (typeof service.label === "string" && service.label.trim()) {
    return service.label.trim();
  }

  if (typeof service.name === "string" && service.name.trim()) {
    return service.name.trim();
  }

  if (typeof service.category === "string" && service.category.trim()) {
    return service.category.trim();
  }

  return null;
}

function readServiceSubtitle(service: Record<string, unknown>): string {
  if (typeof service.priceHint === "string" && service.priceHint.trim()) {
    return service.priceHint.trim();
  }

  if (typeof service.subtitle === "string" && service.subtitle.trim()) {
    return service.subtitle.trim();
  }

  const types = Array.isArray(service.types)
    ? service.types.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  if (types.length > 0) {
    return types.slice(0, 2).join(" · ");
  }

  return "Request a quote";
}

export function buildReviewLinks(settings: PublicBookingSettingsRecord): BrandedReviewLink[] {
  const links: BrandedReviewLink[] = [];

  if (settings.googleReviewUrl?.trim()) {
    links.push({ label: "Google reviews", href: settings.googleReviewUrl.trim() });
  }

  if (settings.yelpReviewUrl?.trim()) {
    links.push({ label: "Yelp reviews", href: settings.yelpReviewUrl.trim() });
  }

  if (settings.facebookReviewUrl?.trim()) {
    links.push({ label: "Facebook reviews", href: settings.facebookReviewUrl.trim() });
  }

  if (settings.customReviewUrl?.trim()) {
    links.push({ label: "Customer reviews", href: settings.customReviewUrl.trim() });
  }

  return links;
}

export function buildServiceCards(offeredServices: Array<Record<string, unknown>>): BrandedServiceCard[] {
  const cards: BrandedServiceCard[] = [];

  for (const service of offeredServices) {
    const title = readServiceLabel(service);

    if (!title) {
      continue;
    }

    cards.push({
      id: title.toLowerCase().replace(/\s+/g, "-"),
      title,
      subtitle: readServiceSubtitle(service)
    });
  }

  if (cards.length === 0) {
    return HOME_SERVICES_FALLBACK_CARDS;
  }

  return cards.slice(0, 4);
}

export function buildServiceAreaSummary(zips: string[]): string {
  const unique = Array.from(new Set(zips.map((zip) => zip.trim()).filter((zip) => zip.length > 0))).sort();

  if (unique.length === 0) {
    return "Service area confirmed during booking or inquiry.";
  }

  if (unique.length <= 6) {
    return `Serving ZIP codes ${unique.join(", ")}.`;
  }

  return `Serving ${unique.length} ZIP codes in your area (including ${unique.slice(0, 3).join(", ")}).`;
}

export function buildBrandedStorefrontViewModel(
  settings: PublicBookingSettingsRecord,
  options?: { staffPreviewLine?: string }
): BrandedStorefrontViewModel {
  const companyName = settings.companyName.trim() || "Your service team";
  const tagline =
    settings.tagline?.trim() ||
    "Instant prices, real tech availability, and booking in under a minute. Same trusted tech every visit.";
  const serviceAreaZips = settings.serviceAreaZipCodes ?? [];

  return {
    companyName,
    bookingSlug: settings.bookingSlug || settings.companySlug,
    tagline,
    phone: settings.phone ?? null,
    logoUrl: settings.logoUrl ?? null,
    serviceCards: buildServiceCards(settings.offeredServices),
    serviceAreaSummary: buildServiceAreaSummary(serviceAreaZips),
    serviceAreaZips: serviceAreaZips,
    trustLine: options?.staffPreviewLine?.trim() || null,
    reviewLinks: buildReviewLinks(settings)
  };
}

export function buildBookPath(slug: string, source = BRANDED_ACQUISITION_SOURCE): string {
  const query = new URLSearchParams({ src: source });
  return `/book/${encodeURIComponent(slug)}?${query.toString()}`;
}

export function buildInquirePath(slug: string, source = BRANDED_ACQUISITION_SOURCE): string {
  const query = new URLSearchParams({ src: source });
  return `/site/${encodeURIComponent(slug)}/inquire?${query.toString()}`;
}

export interface LocalBusinessExtras {
  trade?: SiteTradeConfig;
  openingHours?: ReturnType<typeof buildOpeningHours>;
  /** Only real review data; never fabricated. The public API does not expose a rating yet. */
  rating?: { value: number; count: number } | null;
}

export function buildLocalBusinessJsonLd(
  model: BrandedStorefrontViewModel,
  sitePath: string,
  extras: LocalBusinessExtras = {}
): LocalBusinessJsonLd {
  const { trade, openingHours, rating } = extras;
  return {
    "@context": "https://schema.org",
    "@type": trade?.schemaType ?? "LocalBusiness",
    name: model.companyName,
    description: model.tagline,
    url: sitePath,
    ...(model.phone ? { telephone: model.phone } : {}),
    areaServed: model.serviceAreaZips.length > 0 ? model.serviceAreaZips : ["Local service area"],
    ...(openingHours ? { openingHoursSpecification: openingHours } : {}),
    ...(rating && rating.count > 0
      ? { aggregateRating: { "@type": "AggregateRating" as const, ratingValue: rating.value, reviewCount: rating.count } }
      : {})
  };
}
