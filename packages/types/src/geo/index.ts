/**
 * FS-198: provider-neutral geo/ETA primitives. The default provider uses straight-line
 * (haversine) distance plus an assumed average speed: no external calls, no spend.
 */
export type GeoPoint = { lat: number; lng: number };

export const ETA_SPEED_MPH_DEFAULT = 30;
export const ETA_SPEED_MPH_MIN = 5;
export const ETA_SPEED_MPH_MAX = 80;
/** Straight lines under-count road distance; scale up so "about N min" is not optimistic. */
export const STRAIGHT_LINE_ROAD_FACTOR = 1.3;
export const ETA_MAX_MINUTES = 24 * 60;

const EARTH_RADIUS_MILES = 3958.7613;

export function isValidGeoPoint(point: Partial<GeoPoint> | null | undefined): point is GeoPoint {
  return (
    !!point &&
    typeof point.lat === "number" &&
    typeof point.lng === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180
  );
}

/** Parses stored decimal columns; returns null unless both are present and in range (never guesses). */
export function toGeoPoint(lat: string | number | null | undefined, lng: string | number | null | undefined): GeoPoint | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined || lat === "" || lng === "") return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  return isValidGeoPoint(point) ? point : null;
}

export function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function clampEtaSpeedMph(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return ETA_SPEED_MPH_DEFAULT;
  return Math.min(ETA_SPEED_MPH_MAX, Math.max(ETA_SPEED_MPH_MIN, value));
}

export function estimateStraightLineMinutes(distanceMiles: number, speedMph: number): number {
  const minutes = ((distanceMiles * STRAIGHT_LINE_ROAD_FACTOR) / clampEtaSpeedMph(speedMph)) * 60;
  return Math.min(ETA_MAX_MINUTES, Math.max(1, Math.ceil(minutes)));
}

export type EtaMethod = "straight_line_estimate" | (string & {});
export type EtaConfidence = "low" | "medium" | "high";
