import { and, eq, isNull } from "drizzle-orm";

import { env } from "@fsm/config";
import { jobs, properties, runTransactionWithTenantSession } from "@fsm/db";
import { AppError, ErrorCode, clampEtaSpeedMph, toGeoPoint, type GeoPoint } from "@fsm/types";

import { getGeoProvider } from "./geo-provider.registry.js";

export type JobEtaResult = {
  jobId: string;
  provider: string;
  status: "estimated" | "unavailable";
  method: string | null;
  confidence: string | null;
  minutes: number | null;
  distanceMiles: number | null;
  assumedSpeedMph: number | null;
  unavailableReason: "missing_destination_coordinates" | "missing_property" | null;
};

export function resolveGeoConfig(): { providerId: string; assumedSpeedMph: number } {
  return { providerId: env.GEO_PROVIDER, assumedSpeedMph: clampEtaSpeedMph(env.ETA_ASSUMED_SPEED_MPH) };
}

/**
 * ETA from `origin` (technician's current position, supplied by the caller) to the job's property.
 * Extension point for on-the-way texts: callers of sendOnTheWayNotification may pass
 * `estimatedArrivalMinutes: (await getJobEta(...)).minutes` when status is "estimated";
 * the OTW send path is intentionally not changed here (outbound SMS content).
 */
export async function getJobEta(companyId: string, jobId: string, origin: GeoPoint): Promise<JobEtaResult> {
  const { providerId, assumedSpeedMph } = resolveGeoConfig();
  const provider = getGeoProvider(providerId);

  const row = await runTransactionWithTenantSession(companyId, async (tx) => {
    const [found] = await tx
      .select({
        jobId: jobs.id,
        propertyId: properties.id,
        line1: properties.addressLine1,
        city: properties.city,
        state: properties.state,
        zip: properties.zip,
        country: properties.country,
        lat: properties.lat,
        lng: properties.lng
      })
      .from(jobs)
      .leftJoin(properties, and(eq(properties.id, jobs.propertyId), eq(properties.companyId, companyId)))
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId), isNull(jobs.deletedAt)))
      .limit(1);
    return found ?? null;
  });

  if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Job not found");

  const base = { jobId, provider: provider.id, method: null, confidence: null, minutes: null, distanceMiles: null, assumedSpeedMph: null };
  if (!row.propertyId || !row.line1 || !row.city || !row.state || !row.zip) {
    return { ...base, status: "unavailable", unavailableReason: "missing_property" };
  }

  const geocoded = await provider.geocode({
    address: { line1: row.line1, city: row.city, state: row.state, zip: row.zip, country: row.country ?? null },
    storedLocation: toGeoPoint(row.lat, row.lng)
  });
  if (geocoded.status !== "resolved") {
    return { ...base, status: "unavailable", unavailableReason: "missing_destination_coordinates" };
  }

  const estimate = await provider.estimateTravel(origin, geocoded.location, { assumedSpeedMph });
  return {
    jobId,
    provider: provider.id,
    status: "estimated",
    method: estimate.method,
    confidence: estimate.confidence,
    minutes: estimate.minutes,
    distanceMiles: estimate.distanceMiles,
    assumedSpeedMph,
    unavailableReason: null
  };
}
