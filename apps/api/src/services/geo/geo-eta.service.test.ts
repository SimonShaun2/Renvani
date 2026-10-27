import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, companyIds: [] as string[] }));
vi.mock("@fsm/config", () => ({ env: { GEO_PROVIDER: "straight_line", ETA_ASSUMED_SPEED_MPH: 999 } }));
vi.mock("@fsm/db", () => {
  const chain = { select: () => chain, from: () => chain, leftJoin: () => chain, where: () => chain, limit: async () => (state.row ? [state.row] : []) };
  return {
    jobs: { id: "j.id", companyId: "j.c", propertyId: "j.p", deletedAt: "j.d" },
    properties: { id: "p.id", companyId: "p.c", addressLine1: "a", city: "c", state: "s", zip: "z", country: "co", lat: "lat", lng: "lng" },
    runTransactionWithTenantSession: async (companyId: string, cb: (tx: unknown) => unknown) => {
      state.companyIds.push(companyId);
      return cb(chain);
    }
  };
});

import { getGeoProvider, listGeoProviderIds, registerGeoProvider, straightLineGeoProvider, type GeoProvider } from "./geo-provider.registry.js";
import { getJobEta } from "./job-eta.service.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const jobId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const origin = { lat: 41.8781, lng: -87.6298 };
const property = { jobId, propertyId: "p1", line1: "1 Main", city: "Chicago", state: "IL", zip: "60601", country: "US" };

beforeEach(() => {
  state.companyIds = [];
  registerGeoProvider(straightLineGeoProvider);
});

describe("geo provider registry", () => {
  it("has straight_line by default and rejects unknown ids", () => {
    expect(listGeoProviderIds()).toContain("straight_line");
    expect(() => getGeoProvider("mapbox")).toThrow(/GEO_PROVIDER_UNKNOWN/);
  });

  it("allows register + override and validates ids", () => {
    const fake: GeoProvider = { ...straightLineGeoProvider, id: "test_geo" };
    registerGeoProvider(fake);
    expect(getGeoProvider("test_geo")).toBe(fake);
    const override: GeoProvider = { ...straightLineGeoProvider };
    registerGeoProvider(override);
    expect(getGeoProvider("straight_line")).toBe(override);
    expect(() => registerGeoProvider({ ...fake, id: "Bad-Id" })).toThrow();
  });

  it("straight_line geocode never guesses", async () => {
    const address = { line1: "x", city: "y", state: "z", zip: "1", country: null };
    expect(await straightLineGeoProvider.geocode({ address, storedLocation: null })).toEqual({ status: "unavailable", reason: "missing_coordinates" });
  });
});

describe("getJobEta", () => {
  it("estimates with clamped speed inside a tenant session", async () => {
    state.row = { ...property, lat: "41.9742000", lng: "-87.9073000" };
    const eta = await getJobEta(companyId, jobId, origin);
    expect(state.companyIds).toEqual([companyId]);
    expect(eta).toMatchObject({ status: "estimated", provider: "straight_line", method: "straight_line_estimate", confidence: "low", assumedSpeedMph: 80 });
    expect(eta.minutes).toBe(16);
  });

  it("returns unavailable when destination coordinates are missing", async () => {
    state.row = { ...property, lat: null, lng: null };
    expect(await getJobEta(companyId, jobId, origin)).toMatchObject({ status: "unavailable", minutes: null, unavailableReason: "missing_destination_coordinates" });
  });

  it("returns unavailable when job has no property", async () => {
    state.row = { jobId, propertyId: null, line1: null, city: null, state: null, zip: null, country: null, lat: null, lng: null };
    expect(await getJobEta(companyId, jobId, origin)).toMatchObject({ status: "unavailable", unavailableReason: "missing_property" });
  });

  it("404s when the job is not in this tenant", async () => {
    state.row = null;
    await expect(getJobEta(companyId, jobId, origin)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
