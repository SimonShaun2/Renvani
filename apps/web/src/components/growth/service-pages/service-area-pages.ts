import type { PublicBookingSettingsRecord } from "@/src/hooks/booking.hooks";

import { buildServiceCards, type BrandedServiceCard } from "../branded-storefront.utils";

/**
 * Service x area page template (Growth · Rank & book). Pages are derived from existing public booking data:
 * offeredServices x serviceAreaZipCodes. The public API exposes ZIPs only (no city names), so the area key is the ZIP.
 */
export const SERVICE_PAGE_REVALIDATE_SECONDS = 3600;

export function slugifyService(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export interface ServiceAreaPageRef {
  service: BrandedServiceCard;
  serviceSlug: string;
  area: string;
}

export function listServiceAreaPages(settings: Pick<PublicBookingSettingsRecord, "offeredServices" | "serviceAreaZipCodes">) {
  const services = buildServiceCards(settings.offeredServices);
  const zips = (settings.serviceAreaZipCodes ?? []).filter((zip) => /^\d{5}$/.test(zip));
  return services.flatMap((service) =>
    zips.map((area): ServiceAreaPageRef => ({ service, serviceSlug: slugifyService(service.title), area }))
  );
}

/** Resolves a page only if both the service and the area are really offered; otherwise the route 404s. */
export function resolveServiceAreaPage(
  settings: Pick<PublicBookingSettingsRecord, "offeredServices" | "serviceAreaZipCodes">,
  serviceSlug: string,
  area: string
): ServiceAreaPageRef | null {
  return listServiceAreaPages(settings).find((p) => p.serviceSlug === serviceSlug && p.area === area) ?? null;
}

export function serviceAreaPath(slug: string, ref: Pick<ServiceAreaPageRef, "serviceSlug" | "area">): string {
  return `/site/${slug}/${ref.serviceSlug}/${ref.area}`;
}

/** Figma 155:79 "Nearby services": other offered services in the same ZIP (max 3). */
export function nearbyServicePages(
  settings: Pick<PublicBookingSettingsRecord, "offeredServices" | "serviceAreaZipCodes">,
  current: Pick<ServiceAreaPageRef, "serviceSlug" | "area">,
  max = 3
): ServiceAreaPageRef[] {
  return listServiceAreaPages(settings)
    .filter((p) => p.area === current.area && p.serviceSlug !== current.serviceSlug)
    .slice(0, max);
}

/** Eyebrow "SHOP · CITY". City = first service-area name when the API sends it (#268), else shop only. */
export function serviceEyebrow(companyName: string, settings: Pick<PublicBookingSettingsRecord, "serviceAreaNames">): string {
  const city = settings.serviceAreaNames?.find((name) => name.trim())?.trim();
  return city ? `${companyName} · ${city}` : companyName;
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function hourLabel(h: number): string {
  const v = Math.max(0, Math.min(24, Math.trunc(h)));
  const suffix = v < 12 || v === 24 ? "am" : "pm";
  return `${v % 12 === 0 ? 12 : v % 12}${suffix}`;
}

/**
 * Hours chip, e.g. "Mon–Fri 7am–6pm". Built from the booking window (the only hours the API exposes); runs of
 * consecutive days collapse to ranges. Returns null when there are no usable hours.
 */
export function hoursChip(
  settings: Pick<PublicBookingSettingsRecord, "availableDays" | "availableHoursStart" | "availableHoursEnd">
): string | null {
  const days = new Set(settings.availableDays.map((d) => d.toLowerCase().slice(0, 3)));
  const idx = DAY_ORDER.map((d, i) => (days.has(d) ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0 || settings.availableHoursEnd <= settings.availableHoursStart) return null;
  const runs: string[] = [];
  let start = idx[0]!;
  let prev = start;
  for (const i of [...idx.slice(1), -1]) {
    if (i === prev + 1) {
      prev = i;
      continue;
    }
    const a = DAY_LABEL[DAY_ORDER[start]!]!;
    const b = DAY_LABEL[DAY_ORDER[prev]!]!;
    runs.push(start === prev ? a : `${a}–${b}`);
    start = prev = i;
  }
  return `${runs.join(", ")} ${hourLabel(settings.availableHoursStart)}–${hourLabel(settings.availableHoursEnd)}`;
}
