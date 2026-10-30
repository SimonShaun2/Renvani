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
