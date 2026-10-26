import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real client path: verifyEmailAndSignIn -> publicPost -> global fetch (mocked). No mocked post helper.
const auth = vi.hoisted(() => ({ cleared: 0 }));
vi.mock("./auth", async (orig) => {
  const real = await orig<typeof import("./auth")>();
  return {
    ...real,
    getAuthToken: () => "legacy.jwt",
    clearBrowserAuthSession: () => {
      auth.cleared += 1;
    },
  };
});

import { registerClerkSignOut, registerClerkTokenGetter } from "./clerk/token-bridge";
import { stripTokenFromUrl, verifyEmailAndSignIn } from "./verify-email";

describe("verify-email through the real fetch client", () => {
  const assign = vi.fn();
  const signOut = vi.fn();

  beforeEach(() => {
    auth.cleared = 0;
    assign.mockReset();
    signOut.mockReset();
    vi.stubGlobal("window", { location: { assign, href: "http://localhost/verify-email" } });
    registerClerkTokenGetter(async () => "clerk.jwt");
    registerClerkSignOut(signOut);
  });

  afterEach(() => {
    registerClerkTokenGetter(null);
    registerClerkSignOut(null);
    vi.unstubAllGlobals();
  });

  it.each([401, 400])("a %s returns invalid without logging out or redirecting", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "x" }), { status }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const deps = { setAuth: vi.fn(), redirect: vi.fn() };

    await expect(verifyEmailAndSignIn("tok", deps)).resolves.toEqual({ status: "invalid" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/v1\/auth\/verify-email$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: "tok" });
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    expect(auth.cleared).toBe(0);
    expect(signOut).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(deps.redirect).not.toHaveBeenCalled();
    expect(deps.setAuth).not.toHaveBeenCalled();
  });
});

describe("stripTokenFromUrl", () => {
  it("removes only the token with replaceState", () => {
    const replaceState = vi.fn();
    stripTokenFromUrl({
      location: { href: "http://x/verify-email?token=abc&utm=1#h" } as Location,
      history: { state: null, replaceState } as unknown as History,
    });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/verify-email?utm=1#h");
  });
});
