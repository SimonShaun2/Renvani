import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  getToken: vi.fn<(options?: { skipCache?: boolean }) => Promise<string | null>>(),
  isLoaded: false,
  isSignedIn: undefined as boolean | undefined,
  orgId: undefined as string | null | undefined,
  signOut: vi.fn<(options: { redirectUrl: string }) => Promise<void>>(),
  organizationListLoaded: false,
  memberships: [] as Array<{ organization: { id: string } }>,
  hasNextPage: false,
  membershipsLoading: false,
  setActive: vi.fn<(options: { organization: string }) => Promise<void>>()
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: clerk.getToken,
    isLoaded: clerk.isLoaded,
    isSignedIn: clerk.isSignedIn,
    orgId: clerk.orgId,
    signOut: clerk.signOut
  }),
  useOrganizationList: () => ({
    isLoaded: clerk.organizationListLoaded,
    setActive: clerk.setActive,
    userMemberships: {
      data: clerk.memberships,
      hasNextPage: clerk.hasNextPage,
      isLoading: clerk.membershipsLoading
    }
  })
}));

import { getClerkSessionToken, resetClerkTokenBridge } from "@/src/lib/clerk/token-bridge";
import { ClerkTokenBridge } from "./ClerkTokenBridge";

describe("ClerkTokenBridge", () => {
  beforeEach(() => {
    resetClerkTokenBridge();
    clerk.getToken = vi.fn().mockResolvedValue("clerk.jwt");
    clerk.isLoaded = false;
    clerk.isSignedIn = undefined;
    clerk.orgId = undefined;
    clerk.signOut = vi.fn().mockResolvedValue(undefined);
    clerk.organizationListLoaded = false;
    clerk.memberships = [];
    clerk.hasNextPage = false;
    clerk.membershipsLoading = false;
    clerk.setActive = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it("keeps a pending API token request alive when Clerk callbacks change during hydration", async () => {
    const view = render(<ClerkTokenBridge />);
    const token = getClerkSessionToken();

    clerk.isLoaded = true;
    clerk.isSignedIn = true;
    clerk.orgId = "org_staging";
    clerk.signOut = vi.fn().mockResolvedValue(undefined);
    await act(async () => view.rerender(<ClerkTokenBridge />));

    await expect(token).resolves.toBe("clerk.jwt");
  });

  it("activates the sole organization before issuing the API token", async () => {
    clerk.isLoaded = true;
    clerk.isSignedIn = true;
    clerk.orgId = null;
    clerk.organizationListLoaded = true;
    clerk.memberships = [{ organization: { id: "org_staging" } }];

    render(<ClerkTokenBridge />);

    await expect(getClerkSessionToken()).resolves.toBe("clerk.jwt");
    expect(clerk.setActive).toHaveBeenCalledWith({ organization: "org_staging" });
    expect(clerk.getToken).toHaveBeenCalledWith({ skipCache: true });
  });

  it("fails closed instead of choosing between multiple organizations", async () => {
    clerk.isLoaded = true;
    clerk.isSignedIn = true;
    clerk.orgId = null;
    clerk.organizationListLoaded = true;
    clerk.memberships = [
      { organization: { id: "org_one" } },
      { organization: { id: "org_two" } }
    ];

    render(<ClerkTokenBridge />);

    await expect(getClerkSessionToken()).rejects.toThrow(
      "Clerk session has no active organization and cannot choose between multiple memberships"
    );
    expect(clerk.setActive).not.toHaveBeenCalled();
    expect(clerk.getToken).not.toHaveBeenCalled();
  });

  it("fails explicitly when the signed-in user has no organization membership", async () => {
    clerk.isLoaded = true;
    clerk.isSignedIn = true;
    clerk.orgId = null;
    clerk.organizationListLoaded = true;

    render(<ClerkTokenBridge />);

    await expect(getClerkSessionToken()).rejects.toThrow("Clerk session has no organization membership");
    expect(clerk.setActive).not.toHaveBeenCalled();
  });
});
