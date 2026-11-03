import { describe, expect, it } from "vitest";

import {
  assertSafePublicBookingSlug,
  hasPublicApiPathTraversal,
  hasPublicApiPathTraversalInRequest,
  hasUnsafePublicPathSegment,
  isAllowedPublicApiProxyMethod,
  isPublicApiProxyPath
} from "@/src/lib/public-api-path-security";

describe("public-api-path-security", () => {
  it("identifies public API proxy paths", () => {
    expect(isPublicApiProxyPath("/api/v1/public/booking/acme-hvac")).toBe(true);
    expect(isPublicApiProxyPath("/api/v1/booking-settings")).toBe(false);
  });

  it("rejects dot-segment traversal on public API paths", () => {
    expect(hasPublicApiPathTraversal("/api/v1/public/booking/../secrets")).toBe(true);
    expect(hasPublicApiPathTraversal("/api/v1/public/booking/%2e%2e/secrets")).toBe(true);
    expect(hasPublicApiPathTraversal("/api/v1/public/booking/%2E%2E/secrets")).toBe(true);
    expect(hasPublicApiPathTraversal("/api/v1/public/booking/%252e%252e/secrets")).toBe(true);
  });

  it("detects traversal in raw request URL when pathname is normalized", () => {
    expect(
      hasPublicApiPathTraversalInRequest(
        "http://localhost:3000/api/v1/public/booking/%2e%2e/admin",
        "/api/v1/public/admin"
      )
    ).toBe(true);
  });

  it("allows normal public booking paths", () => {
    expect(hasPublicApiPathTraversal("/api/v1/public/booking/acme-hvac")).toBe(false);
  });

  it("allowlists safe HTTP methods on the public API proxy", () => {
    expect(isAllowedPublicApiProxyMethod("GET")).toBe(true);
    expect(isAllowedPublicApiProxyMethod("head")).toBe(true);
    expect(isAllowedPublicApiProxyMethod("POST")).toBe(true);
    expect(isAllowedPublicApiProxyMethod("DELETE")).toBe(false);
    expect(isAllowedPublicApiProxyMethod("PUT")).toBe(false);
  });

  it("rejects unsafe booking slug segments", () => {
    expect(hasUnsafePublicPathSegment("acme-hvac")).toBe(false);
    expect(hasUnsafePublicPathSegment("../admin")).toBe(true);
    expect(hasUnsafePublicPathSegment("acme%2fhvac")).toBe(true);

    expect(() => assertSafePublicBookingSlug("acme-hvac")).not.toThrow();
    expect(() => assertSafePublicBookingSlug("..%2fsecrets")).toThrow();
  });
});
