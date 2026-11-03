import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleUnauthorized, resolveBearerToken } from "./api";
import { registerClerkSignOut, registerClerkTokenGetter } from "./clerk/token-bridge";

const auth = vi.hoisted(() => ({ legacy: null as string | null, cleared: 0 }));
vi.mock("./auth", () => ({
  getAuthToken: () => auth.legacy,
  clearBrowserAuthSession: () => {
    auth.cleared += 1;
  }
}));

describe("API 401 handling", () => {
  const assign = vi.fn();

  beforeEach(() => {
    auth.legacy = null;
    auth.cleared = 0;
    assign.mockReset();
    vi.stubGlobal("window", { location: { assign } });
  });

  afterEach(() => {
    registerClerkTokenGetter(null);
    registerClerkSignOut(null);
    vi.unstubAllGlobals();
  });

  it("signs a Clerk user out (no /login bounce loop)", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    registerClerkSignOut(signOut);
    await handleUnauthorized("clerk");
    expect(signOut).toHaveBeenCalledWith("/login");
    expect(auth.cleared).toBe(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it("goes to /no-access, never /login, if Clerk signOut fails", async () => {
    registerClerkSignOut(vi.fn().mockRejectedValue(new Error("x")));
    await handleUnauthorized("clerk");
    expect(assign).toHaveBeenCalledWith("/no-access");
  });

  it("keeps the legacy behavior: clear session and go to /login", async () => {
    const signOut = vi.fn();
    registerClerkSignOut(signOut);
    await handleUnauthorized("legacy");
    expect(signOut).not.toHaveBeenCalled();
    expect(auth.cleared).toBe(1);
    expect(assign).toHaveBeenCalledWith("/login");
  });
});

describe("bearer token precedence", () => {
  afterEach(() => registerClerkTokenGetter(null));

  it("prefers the legacy JWT, then the Clerk token, then none", async () => {
    auth.legacy = "legacy.jwt";
    registerClerkTokenGetter(async () => "clerk.jwt");
    expect(await resolveBearerToken()).toEqual({ token: "legacy.jwt", source: "legacy" });
    auth.legacy = null;
    expect(await resolveBearerToken()).toEqual({ token: "clerk.jwt", source: "clerk" });
    registerClerkTokenGetter(null);
    expect(await resolveBearerToken()).toEqual({ token: null, source: null });
  });
});
