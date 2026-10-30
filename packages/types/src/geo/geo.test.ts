import { describe, expect, it } from "vitest";

import {
  ETA_SPEED_MPH_DEFAULT,
  ETA_SPEED_MPH_MAX,
  ETA_SPEED_MPH_MIN,
  clampEtaSpeedMph,
  estimateStraightLine,
  estimateStraightLineMinutes,
  haversineMiles,
  toGeoPoint
} from "./index.js";

describe("geo primitives", () => {
  it("computes haversine distance (Chicago Loop → O'Hare ≈ 15.7 mi)", () => {
    const miles = haversineMiles({ lat: 41.8781, lng: -87.6298 }, { lat: 41.9742, lng: -87.9073 });
    expect(miles).toBeGreaterThan(15.5);
    expect(miles).toBeLessThan(16.0);
    expect(haversineMiles({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });

  it("clamps the assumed speed and defaults on bad input", () => {
    expect(clampEtaSpeedMph(undefined)).toBe(ETA_SPEED_MPH_DEFAULT);
    expect(clampEtaSpeedMph(Number.NaN)).toBe(ETA_SPEED_MPH_DEFAULT);
    expect(clampEtaSpeedMph(1)).toBe(ETA_SPEED_MPH_MIN);
    expect(clampEtaSpeedMph(500)).toBe(ETA_SPEED_MPH_MAX);
    expect(clampEtaSpeedMph(45)).toBe(45);
  });

  it("estimates minutes with road factor, minimum 1", () => {
    expect(estimateStraightLineMinutes(10, 30)).toBe(26);
    expect(estimateStraightLineMinutes(0, 30)).toBe(1);
  });

  it("never guesses coordinates", () => {
    expect(toGeoPoint(null, "-87.1")).toBeNull();
    expect(toGeoPoint("91", "0")).toBeNull();
    expect(toGeoPoint("", "")).toBeNull();
    expect(toGeoPoint("41.5000000", "-87.2500000")).toEqual({ lat: 41.5, lng: -87.25 });
  });

  it("estimateStraightLine is the single shared helper (road factor + clamp + rounding)", () => {
    const loop = { lat: 41.8781, lng: -87.6298 };
    const ohare = { lat: 41.9742, lng: -87.9073 };
    expect(estimateStraightLine(loop, ohare, 30)).toEqual({ minutes: 41, distanceMiles: 15.73 });
    expect(estimateStraightLine(loop, ohare, 500)).toEqual({ minutes: 16, distanceMiles: 15.73 });
    expect(estimateStraightLine(loop, ohare)).toEqual(estimateStraightLine(loop, ohare, ETA_SPEED_MPH_DEFAULT));
    expect(estimateStraightLine(loop, loop, 30)).toEqual({ minutes: 1, distanceMiles: 0 });
  });
});
