import { afterEach, describe, expect, it, vi } from "vitest";

import { getWorkspaceIntent, reserveWorkspaceIntent, waitForWorkspaceIntent } from "./workspace-intent";

function response(intent: unknown, status = 200): Response {
  return new Response(JSON.stringify({ intent }), { status, headers: { "Content-Type": "application/json" } });
}

describe("workspace intent client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts only the name and bearer token to the authoritative endpoint", async () => {
    const fetchMock = vi.fn(async () => response({
      id: "00000000-0000-4000-8000-000000000001", requestedName: "Acme", status: "pending",
      createdAt: "2026-11-01T00:00:00.000Z"
    }));
    vi.stubGlobal("fetch", fetchMock);
    await reserveWorkspaceIntent("token", "Acme");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/v1/onboarding/workspace-intent");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ name: "Acme" }));
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token");
  });

  it("polls until the server returns its reconciled organization", async () => {
    const pending = {
      id: "00000000-0000-4000-8000-000000000001", requestedName: "Acme", status: "pending",
      createdAt: "2026-11-01T00:00:00.000Z"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(pending))
      .mockResolvedValueOnce(response({ ...pending, status: "reconciled", organizationId: "org_1" }));
    vi.stubGlobal("fetch", fetchMock);
    let now = 0;
    const result = await waitForWorkspaceIntent({
      name: "Acme", getFreshToken: async () => "token", isCurrent: () => true,
      now: () => now, sleep: async (ms) => { now += ms; }
    });
    expect(result).toEqual({ ok: true, organizationId: "org_1", requestedName: "Acme" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects reconciled responses that omit the authoritative organization id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({
      id: "00000000-0000-4000-8000-000000000001", requestedName: "Acme", status: "reconciled",
      createdAt: "2026-11-01T00:00:00.000Z"
    })));
    await expect(getWorkspaceIntent("token")).rejects.toThrow("omitted its organization id");
  });

  it("stops polling immediately after an account switch", async () => {
    const pending = {
      id: "00000000-0000-4000-8000-000000000001", requestedName: "Acme", status: "pending",
      createdAt: "2026-11-01T00:00:00.000Z"
    };
    const fetchMock = vi.fn(async () => response(pending));
    vi.stubGlobal("fetch", fetchMock);
    let current = true;
    const result = await waitForWorkspaceIntent({
      name: "Acme", getFreshToken: async () => "token", isCurrent: () => current,
      sleep: async () => { current = false; }
    });
    expect(result).toEqual({ ok: false, reason: "cancelled" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
