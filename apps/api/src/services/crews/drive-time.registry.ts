/**
 * FS-195 — drive-time estimator registry for dispatch. The built-in `straight_line` estimator
 * uses haversine distance × road factor at an assumed speed: no external calls, no spend.
 * Road-network providers can be registered later (provider/spend decision is Shaun's).
 * NOTE: converge with the FS-198 geo provider registry (PR #236) once both are on dev.
 */
export type LatLng = { lat: number; lng: number };
export type DriveTimeEstimate = { minutes: number; distanceMiles: number; method: string; confidence: "low" | "medium" | "high" };
export interface DriveTimeEstimator {
  id: string;
  method: string;
  confidence: "low" | "medium" | "high";
  estimate(from: LatLng, to: LatLng): DriveTimeEstimate;
}

export const DRIVE_SPEED_MPH_DEFAULT = 30;
const SPEED_MIN = 5;
const SPEED_MAX = 80;
const ROAD_FACTOR = 1.3;
const EARTH_RADIUS_MILES = 3958.7613;

export function clampDriveSpeedMph(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DRIVE_SPEED_MPH_DEFAULT;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, value));
}

export function haversineMiles(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function createStraightLineEstimator(speedMph?: number): DriveTimeEstimator {
  const speed = clampDriveSpeedMph(speedMph);
  return {
    id: "straight_line",
    method: "straight_line_estimate",
    confidence: "low",
    estimate(from, to) {
      const miles = haversineMiles(from, to);
      return {
        minutes: miles === 0 ? 0 : Math.max(1, Math.ceil(((miles * ROAD_FACTOR) / speed) * 60)),
        distanceMiles: Math.round(miles * 100) / 100,
        method: "straight_line_estimate",
        confidence: "low"
      };
    }
  };
}

const estimators = new Map<string, DriveTimeEstimator>();

export function registerDriveTimeEstimator(estimator: DriveTimeEstimator): void {
  if (!/^[a-z][a-z0-9_]{0,63}$/u.test(estimator.id)) throw new Error(`Invalid drive-time estimator id: ${estimator.id}`);
  estimators.set(estimator.id, estimator);
}

export function getDriveTimeEstimator(id: string): DriveTimeEstimator {
  const estimator = estimators.get(id);
  if (!estimator) throw new Error(`DRIVE_TIME_ESTIMATOR_UNKNOWN:${id}`);
  return estimator;
}

/** Resolves the configured estimator; the default straight_line one uses the configured speed. */
export function resolveDriveTimeEstimator(config: { DRIVE_TIME_ESTIMATOR: string; DRIVE_TIME_ASSUMED_SPEED_MPH: number }): DriveTimeEstimator {
  if (config.DRIVE_TIME_ESTIMATOR === "straight_line" && !estimators.has("straight_line")) {
    return createStraightLineEstimator(config.DRIVE_TIME_ASSUMED_SPEED_MPH);
  }
  return getDriveTimeEstimator(config.DRIVE_TIME_ESTIMATOR);
}
