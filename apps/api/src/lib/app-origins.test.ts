import { describe, expect, it } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const {
  allowedAppOrigins,
  currentAppBaseUrl,
  extraAppOrigins,
  parseAllowedOriginList,
  resolveAppBaseUrl,
  runWithRequestOrigin
} = await import("./app-origins.js");

const STAGING = { RENVANI_DEPLOYMENT_TIER: "staging" };
const PROD = { RENVANI_DEPLOYMENT_TIER: "production" };
const DEV = {};
const src = {
  APP_URL: "https://app.renvani.com/",
  APP_URL_ALLOWED: " https://tester.renvani.com , https://app.renvani.com,http://localhost:3000/,https://*.vercel.app,https://x.test/path,ftp://f.test,not a url"
};

describe("APP_URL_ALLOWED", () => {
  it("parses exact origins only; rejects wildcards, paths, non-http(s) and junk; dedupes", () => {
    expect(parseAllowedOriginList(src.APP_URL_ALLOWED)).toEqual([
      "https://tester.renvani.com",
      "https://app.renvani.com",
      "http://localhost:3000"
    ]);
    expect(parseAllowedOriginList("")).toEqual([]);
    expect(parseAllowedOriginList(undefined)).toEqual([]);
  });

  it("accepts https extras; allows plain http only for localhost / 127.0.0.1", () => {
    expect(
      parseAllowedOriginList(
        "http://tester.renvani.com,http://preview.vercel.app,https://tester.renvani.com,http://localhost:3000,http://127.0.0.1:3000"
      )
    ).toEqual(["https://tester.renvani.com", "http://localhost:3000", "http://127.0.0.1:3000"]);
  });

  it("extras are honored only in the staging tier; APP_URL is always primary and first", () => {
    expect(allowedAppOrigins(src, STAGING)).toEqual([
      "https://app.renvani.com",
      "https://tester.renvani.com",
      "http://localhost:3000"
    ]);
    expect(allowedAppOrigins(src, PROD)).toEqual(["https://app.renvani.com"]);
    expect(allowedAppOrigins(src, DEV)).toEqual(["https://app.renvani.com"]);
    expect(extraAppOrigins(src, PROD)).toEqual([]);
  });

  it("resolveAppBaseUrl uses the request origin only on an exact allowed match in staging", () => {
    expect(resolveAppBaseUrl("https://tester.renvani.com", src, STAGING)).toBe("https://tester.renvani.com");
    expect(resolveAppBaseUrl("https://tester.renvani.com", src, PROD)).toBe("https://app.renvani.com");
    expect(resolveAppBaseUrl("https://evil.renvani.com", src, STAGING)).toBe("https://app.renvani.com");
    expect(resolveAppBaseUrl("https://tester.renvani.com.evil.test", src, STAGING)).toBe("https://app.renvani.com");
    expect(resolveAppBaseUrl("https://foo.vercel.app", src, STAGING)).toBe("https://app.renvani.com");
    expect(resolveAppBaseUrl("http://tester.renvani.com", src, STAGING)).toBe("https://app.renvani.com");
    expect(resolveAppBaseUrl(null, src, STAGING)).toBe("https://app.renvani.com");
    expect(resolveAppBaseUrl("null", src, STAGING)).toBe("https://app.renvani.com");
  });

  it("currentAppBaseUrl falls back to APP_URL outside a request and for unlisted origins", () => {
    expect(currentAppBaseUrl()).toBe("http://localhost:3000");
    expect(runWithRequestOrigin("https://evil.test", () => currentAppBaseUrl())).toBe("http://localhost:3000");
  });
});
