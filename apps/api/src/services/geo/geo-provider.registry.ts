import {
  AppError,
  ErrorCode,
  estimateStraightLine,
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
  if (!provider) {
    // Handled AppError (not a bare Error) so a misconfiguration never surfaces as an unhandled 500.
    throw new AppError(ErrorCode.INTERNAL_ERROR, `GEO_PROVIDER_UNKNOWN: geo provider "${id}" is not registered`);
  }
  return provider;
}

/**
 * Boot-time check: fail fast when GEO_PROVIDER names an unregistered provider. Call after all
 * plugins that may `registerGeoProvider` have loaded (buildApp does this after route registration).
 */
export function assertGeoProviderConfigured(providerId: string): void {
  if (!providers.has(providerId)) {
    throw new Error(
      `GEO_PROVIDER="${providerId}" is not a registered geo provider (registered: ${listGeoProviderIds().join(", ") || "none"}). ` +
        "Register it with registerGeoProvider() before startup or unset GEO_PROVIDER to use straight_line."
    );
  }
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
    return {
      ...estimateStraightLine(origin, destination, options.assumedSpeedMph),
      method: "straight_line_estimate",
      confidence: "low"
    };
  }
};

registerGeoProvider(straightLineGeoProvider);
