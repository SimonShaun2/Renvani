import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "../middleware";

const PUBLIC_URL = "http://localhost:3000/api/v1/public/booking/acme-hvac";

// NextResponse.next({ request: { headers } }) encodes request-header overrides as
// x-middleware-override-headers + x-middleware-request-<name> on the response.
function forwardedOriginSecret(response: Response): string | null {
  return response.headers.get("x-middleware-request-x-origin-secret");
}

function overriddenHeaderNames(response: Response): string[] {
  return (response.headers.get("x-middleware-override-headers") ?? "").split(",").filter(Boolean);
}

describe("middleware x-origin-secret on public API proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("strips a client-supplied x-origin-secret when ORIGIN_SECRET is unset", async () => {
    vi.stubEnv("ORIGIN_SECRET", "");
    const request = new NextRequest(PUBLIC_URL, { method: "GET", headers: { "x-origin-secret": "spoofed" } });

    const response = await middleware(request);

    expect(forwardedOriginSecret(response)).toBeNull();
    expect(overriddenHeaderNames(response)).not.toContain("x-origin-secret");
  });

  it("replaces a client-supplied value with ORIGIN_SECRET when set", async () => {
    vi.stubEnv("ORIGIN_SECRET", "test-origin-secret");
    const request = new NextRequest(PUBLIC_URL, { method: "GET", headers: { "x-origin-secret": "spoofed" } });

    const response = await middleware(request);

    expect(forwardedOriginSecret(response)).toBe("test-origin-secret");
    expect(overriddenHeaderNames(response)).toContain("x-origin-secret");
  });

  it("does not add the header when ORIGIN_SECRET is unset", async () => {
    vi.stubEnv("ORIGIN_SECRET", "");
    const response = await middleware(new NextRequest(PUBLIC_URL, { method: "GET" }));

    expect(response.status).toBe(200);
    expect(forwardedOriginSecret(response)).toBeNull();
  });

  it("never exposes the secret as a response header", async () => {
    vi.stubEnv("ORIGIN_SECRET", "test-origin-secret");
    const response = await middleware(new NextRequest(PUBLIC_URL, { method: "GET" }));

    expect(response.headers.get("x-origin-secret")).toBeNull();
  });

  it("does not touch non-public paths", async () => {
    vi.stubEnv("ORIGIN_SECRET", "test-origin-secret");
    const response = await middleware(new NextRequest("http://localhost:3000/login", { method: "GET" }));

    expect(forwardedOriginSecret(response)).toBeNull();
    expect(response.headers.get("x-middleware-override-headers")).toBeNull();
  });

  it("still rejects unsupported methods before forwarding", async () => {
    vi.stubEnv("ORIGIN_SECRET", "test-origin-secret");
    const response = await middleware(new NextRequest(PUBLIC_URL, { method: "DELETE" }));

    expect(response.status).toBe(405);
    expect(forwardedOriginSecret(response)).toBeNull();
  });
});
