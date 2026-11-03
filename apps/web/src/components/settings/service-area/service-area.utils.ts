import { SERVICE_AREA_MAX_RADIUS_MILES, SERVICE_AREA_MAX_ZIPS, type UpdateEmergencyServiceBody, type UpdateServiceAreaBody } from "@fsm/types";

/** Same rule as #320's UsZipSchema: 5 digits or ZIP+4, stored as the 5-digit ZIP. Returns null when invalid. */
export function normalizeZipInput(value: string): string | null {
  const trimmed = value.trim();
  return /^\d{5}(?:-?\d{4})?$/u.test(trimmed) ? trimmed.slice(0, 5) : null;
}

export function addZip(zips: readonly string[], zip: string): string[] {
  return zips.includes(zip) ? [...zips] : [...zips, zip];
}

/** #320 caps the list at SERVICE_AREA_MAX_ZIPS (500); enforced here before the PUT. */
export function zipCapReached(zips: readonly string[], zip: string): boolean {
  return !zips.includes(zip) && zips.length >= SERVICE_AREA_MAX_ZIPS;
}

/** #320 writes are owner/admin only (requireRole(["owner","admin"])); dispatcher/office/technician are read-only. */
export function canEditHomeServices(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function isForbidden(error: unknown): boolean {
  return (error as { status?: unknown } | null)?.status === 403;
}

/** Radius step from an unset (null) radius starts at one step; the API has no documented default. */
export function stepRadius(current: number | null, delta: number): number | null {
  if (current === null) return delta > 0 ? clampRadius(delta) : null;
  return clampRadius(current + delta);
}

export function clampRadius(miles: number): number {
  return Math.min(SERVICE_AREA_MAX_RADIUS_MILES, Math.max(1, Math.round(miles)));
}

export function buildServiceAreaPayload(zips: readonly string[], radiusMiles: number | null): UpdateServiceAreaBody {
  return { zips: [...zips], radiusMiles };
}

/** hoursText is kept as stored; the frames have no hours field. */
export function buildEmergencyPayload(enabled: boolean, hoursText: string | null): UpdateEmergencyServiceBody {
  return hoursText ? { enabled, hoursText } : { enabled };
}
