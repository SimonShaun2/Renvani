import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "../middleware";

describe("middleware public API proxy", () => {
  it("allows unauthenticated GET /api/v1/public/booking/:slug without login redirect", async () => {
    const request = new NextRequest("http://localhost:3000/api/v1/public/booking/acme-hvac", {
      method: "GET"
    });

    const response = await middleware(request);

    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("returns 400 for traversal attempts on public API paths", async () => {
    // NextRequest normalizes %2e%2e segments; mixed encodings like ..%2f remain in the URL.
    const request = new NextRequest("http://localhost:3000/api/v1/public/booking/..%2fadmin", {
      method: "GET"
    });

    const response = await middleware(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 for double-encoded traversal on public API paths", async () => {
    const request = new NextRequest("http://localhost:3000/api/v1/public/booking/%252e%252e/admin", {
      method: "GET"
    });

    const response = await middleware(request);

    expect(response.status).toBe(400);
  });

  it("returns 405 for unsupported methods on public API proxy paths", async () => {
    const request = new NextRequest("http://localhost:3000/api/v1/public/booking/acme-hvac", {
      method: "DELETE"
    });

    const response = await middleware(request);

    expect(response.status).toBe(405);
  });
});
