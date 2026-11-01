import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedFetch } from "./api";
import { registerClerkSignOut, registerClerkTokenGetter } from "./clerk/token-bridge";
import { uploadImportFileForMigrate } from "@/src/hooks/migrate-onboarding.hooks";

const auth = vi.hoisted(() => ({ legacy: null as string | null, cleared: 0 }));
vi.mock("./auth", () => ({
  getAuthToken: () => auth.legacy,
  clearBrowserAuthSession: () => {
    auth.cleared += 1;
  }
}));

function sentAuthorization(fetchMock: ReturnType<typeof vi.fn>): string | null {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
  return new Headers(init.headers).get("Authorization");
}

describe("authorizedFetch (shared upload auth)", () => {
  const assign = vi.fn();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    auth.legacy = null;
    auth.cleared = 0;
    assign.mockReset();
    fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { location: { assign } });
  });

  afterEach(() => {
    registerClerkTokenGetter(null);
    registerClerkSignOut(null);
    vi.unstubAllGlobals();
  });

  it("sends the Clerk session token when present (wins over legacy)", async () => {
    auth.legacy = "legacy-jwt";
    registerClerkTokenGetter(async () => "clerk-jwt");

    await authorizedFetch("/api/v1/imports", { method: "POST", body: new FormData() });

    expect(sentAuthorization(fetchMock)).toBe("Bearer clerk-jwt");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe("include");
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/imports$/);
  });

  it("falls back to the legacy JWT without Clerk", async () => {
    auth.legacy = "legacy-jwt";

    await authorizedFetch("/api/v1/imports", { method: "POST" });

    expect(sentAuthorization(fetchMock)).toBe("Bearer legacy-jwt");
  });

  it("sends no Authorization header when signed out", async () => {
    await authorizedFetch("/api/v1/imports", { method: "POST" });

    expect(sentAuthorization(fetchMock)).toBeNull();
  });

  it("on 401 with a Clerk session signs out of Clerk instead of bouncing to /login", async () => {
    registerClerkTokenGetter(async () => "clerk-jwt");
    const signOut = vi.fn().mockResolvedValue(undefined);
    registerClerkSignOut(signOut);
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));

    const response = await authorizedFetch("/api/v1/imports", { method: "POST" });

    expect(response.status).toBe(401);
    expect(signOut).toHaveBeenCalledWith("/login");
    expect(assign).not.toHaveBeenCalledWith("/login");
  });

  it("on 401 with a legacy session clears it and goes to /login", async () => {
    auth.legacy = "legacy-jwt";
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));

    await authorizedFetch("/api/v1/imports", { method: "POST" });

    expect(auth.cleared).toBe(1);
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("migrate import upload uses the Clerk token through the shared helper", async () => {
    registerClerkTokenGetter(async () => "clerk-jwt");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ session: { id: "s1" } }), { status: 201 }));

    await uploadImportFileForMigrate(new File(["a,b"], "c.csv", { type: "text/csv" }), "customers").catch(() => undefined);

    expect(sentAuthorization(fetchMock)).toBe("Bearer clerk-jwt");
  });
});
