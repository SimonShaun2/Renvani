import {
  clampEtaSpeedMph,
  estimateStraightLineMinutes,
  haversineMiles,
  type EtaConfidence,
  type EtaMethod,
  type GeoPoint
} from "@fsm/types";

/**
 * FS-198 geo provider registry. A provider resolves a destination location (geocode) and
 * estimates travel (ETA). The built-in `straight_line` provider makes no external calls:
 * geocode only returns already-stored coordinates, and ETA is haversine × road factor at an
 * assumed speed. Nominatim/Mapbox/Google can be registered later (Shaun approval for spend).
 */
export type GeocodeInput = {
  address: { line1: string; city: string; state: string; zip: string; country: string | null };
  storedLocation: GeoPoint | null;
};

export type GeocodeResult =
  | { status: "resolved"; location: GeoPoint; source: "stored" | "provider" }
  | { status: "unavailable"; reason: "missing_coordinates" | "not_found" };

export type TravelEstimate = {
  minutes: number;
  distanceMiles: number;
  method: EtaMethod;
  confidence: EtaConfidence;
};

export type TravelEstimateOptions = { assumedSpeedMph: number };

export interface GeoProvider {
  id: string;
  geocode(input: GeocodeInput): Promise<GeocodeResult>;
  estimateTravel(origin: GeoPoint, destination: GeoPoint, options: TravelEstimateOptions): Promise<TravelEstimate>;
}

const providers = new Map<string, GeoProvider>();

export const STRAIGHT_LINE_PROVIDER_ID = "straight_line";

export function registerGeoProvider(provider: GeoProvider): void {
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(provider.id)) throw new Error(`Invalid geo provider id: ${provider.id}`);
  providers.set(provider.id, provider);
}

export function getGeoProvider(id: string): GeoProvider {
  const provider = providers.get(id);
  if (!provider) throw new Error(`GEO_PROVIDER_UNKNOWN:${id}`);
  return provider;
}

export function listGeoProviderIds(): string[] {
  return [...providers.keys()];
}

export const straightLineGeoProvider: GeoProvider = {
  id: STRAIGHT_LINE_PROVIDER_ID,
  async geocode(input) {
    return input.storedLocation
      ? { status: "resolved", location: input.storedLocation, source: "stored" }
      : { status: "unavailable", reason: "missing_coordinates" };
  },
  async estimateTravel(origin, destination, options) {
    const distanceMiles = haversineMiles(origin, destination);
    return {
      minutes: estimateStraightLineMinutes(distanceMiles, clampEtaSpeedMph(options.assumedSpeedMph)),
      distanceMiles: Math.round(distanceMiles * 100) / 100,
      method: "straight_line_estimate",
      confidence: "low"
    };
  }
};

registerGeoProvider(straightLineGeoProvider);
