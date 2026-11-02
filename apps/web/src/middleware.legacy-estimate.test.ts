import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { middleware } from "../middleware";

const LEGACY_TOKEN = "abcdefghijklmnopqrstuvwxyz012345";
const STAFF_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("middleware legacy GET /estimates/:token recovery (FS-36)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("returns 307 to /approve when public API validation succeeds", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ estimate: {} }), { status: 200 }))
    );

    const request = new NextRequest(`http://localhost:3000/estimates/${LEGACY_TOKEN}`, { method: "GET" });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`http://localhost:3000/approve/${LEGACY_TOKEN}`);
  });

  it.each(["/robots.txt", "/sitemap.xml", "/sitemap-index.xml", "/sitemap/0.xml"])("legacy auth: %s is not redirected to /login when signed out", async (path) => {
    const response = await middleware(new NextRequest(`http://localhost:3000${path}`, { method: "GET" }));
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not call public API for staff UUID paths (auth flow continues)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(`http://localhost:3000/estimates/${STAFF_UUID}`, { method: "GET" });
    const response = await middleware(request);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("HEAD link previews get the same 307 to /approve as GET when validation succeeds", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ estimate: {} }), { status: 200 }))
    );

    const request = new NextRequest(`http://localhost:3000/estimates/${LEGACY_TOKEN}`, { method: "HEAD" });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`http://localhost:3000/approve/${LEGACY_TOKEN}`);
  });

  it("returns 404 for malformed legacy segments without public API call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost:3000/estimates/guess", { method: "GET" });
    const response = await middleware(request);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });
});
