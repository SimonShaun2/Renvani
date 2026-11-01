import { afterEach, describe, expect, it, vi } from "vitest";

import { completeClientLogout } from "./client-logout";
import { registerClerkSignOut, registerClerkTokenGetter } from "./clerk/token-bridge";

afterEach(() => {
  registerClerkTokenGetter(null);
  registerClerkSignOut(null);
});

describe("completeClientLogout", () => {
  it("clears tenant-local state and lets Clerk finish its own redirect", async () => {
    const clearAuth = vi.fn();
    const redirect = vi.fn();
    const signOut = vi.fn().mockResolvedValue(undefined);
    registerClerkTokenGetter(async () => "clerk.jwt");
    registerClerkSignOut(signOut);

    await completeClientLogout({ clearAuth, redirect });

    expect(clearAuth).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith("/login");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("clears tenant-local state and redirects a legacy session to login", async () => {
    const clearAuth = vi.fn();
    const redirect = vi.fn();

    await completeClientLogout({ clearAuth, redirect });

    expect(clearAuth).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("does not redirect an active Clerk session back into a login bounce when sign-out fails", async () => {
    const clearAuth = vi.fn();
    const redirect = vi.fn();
    registerClerkTokenGetter(async () => "clerk.jwt");
    registerClerkSignOut(vi.fn().mockRejectedValue(new Error("Clerk unavailable")));

    await completeClientLogout({ clearAuth, redirect });

    expect(clearAuth).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/no-access");
  });
});
