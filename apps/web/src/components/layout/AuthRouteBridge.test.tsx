import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSessionSnapshot } from "@/src/lib/auth";
import { resolveBearerToken } from "@/src/lib/api";
import { registerClerkTokenGetter } from "@/src/lib/clerk/token-bridge";
import { useAuthStore } from "@/src/stores/auth.store";

import { AuthRouteBridge } from "./AuthRouteBridge";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/mobile/jobs" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace })
}));

const clerkSession: AuthSessionSnapshot = {
  role: "technician",
  user: {
    id: "user_clerk",
    email: "tech@example.test",
    firstName: "Taylor",
    lastName: "Tech",
    role: "technician"
  },
  company: { id: "org_clerk", name: "Clerk HVAC" }
};

beforeEach(() => {
  document.cookie = "fsm_auth_token=; Max-Age=0; Path=/";
  registerClerkTokenGetter(null);
  useAuthStore.setState({ user: null, company: null, token: null });
  navigation.replace.mockReset();
});

afterEach(() => {
  registerClerkTokenGetter(null);
  cleanup();
});

describe("AuthRouteBridge identity hydration", () => {
  it("hydrates a Clerk-only technician without a legacy token", async () => {
    render(<AuthRouteBridge session={clerkSession}>jobs</AuthRouteBridge>);

    await waitFor(() => expect(useAuthStore.getState().user).toEqual(clerkSession.user));
    expect(useAuthStore.getState().company).toEqual(clerkSession.company);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("replaces stale identity and token with the authoritative server session", async () => {
    useAuthStore.getState().setAuth(
      { id: "old-user", email: "old@example.test", firstName: "Old", lastName: "User", role: "owner" },
      { id: "old-company", name: "Old Plumbing" },
      "stale.jwt"
    );

    render(<AuthRouteBridge session={clerkSession}>jobs</AuthRouteBridge>);

    await waitFor(() => expect(useAuthStore.getState().user?.id).toBe("user_clerk"));
    expect(useAuthStore.getState().company?.id).toBe("org_clerk");
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("keeps rendered identity and API authorization on the same legacy tenant in a mixed session", async () => {
    const legacySession: AuthSessionSnapshot = {
      role: "owner",
      user: { id: "legacy-user", email: "owner@legacy.test", firstName: "Legacy", lastName: "Owner", role: "owner" },
      company: { id: "legacy-company", name: "Legacy Plumbing" }
    };
    document.cookie = "fsm_auth_token=legacy.jwt; Path=/";
    registerClerkTokenGetter(async () => "clerk.other-tenant.jwt");

    render(<AuthRouteBridge session={legacySession}>dashboard</AuthRouteBridge>);

    await waitFor(() => expect(useAuthStore.getState().company?.id).toBe("legacy-company"));
    expect(useAuthStore.getState().user?.id).toBe("legacy-user");
    expect(await resolveBearerToken()).toEqual({ token: "legacy.jwt", source: "legacy" });
  });
});
