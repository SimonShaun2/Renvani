import { SERVICE_AREA_MAX_RADIUS_MILES, type UpdateEmergencyServiceBody, type UpdateServiceAreaBody } from "@fsm/types";

/** Same rule as #320's UsZipSchema: 5 digits or ZIP+4, stored as the 5-digit ZIP. Returns null when invalid. */
export function normalizeZipInput(value: string): string | null {
  const trimmed = value.trim();
  return /^\d{5}(?:-?\d{4})?$/u.test(trimmed) ? trimmed.slice(0, 5) : null;
}

export function addZip(zips: readonly string[], zip: string): string[] {
  return zips.includes(zip) ? [...zips] : [...zips, zip];
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
