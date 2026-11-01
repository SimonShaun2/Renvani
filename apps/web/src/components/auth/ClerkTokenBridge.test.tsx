import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  getToken: vi.fn<() => Promise<string | null>>(),
  isLoaded: false,
  isSignedIn: undefined as boolean | undefined,
  signOut: vi.fn<(options: { redirectUrl: string }) => Promise<void>>()
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: clerk.getToken,
    isLoaded: clerk.isLoaded,
    isSignedIn: clerk.isSignedIn,
    signOut: clerk.signOut
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
    clerk.signOut = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it("keeps a pending API token request alive when Clerk callbacks change during hydration", async () => {
    const view = render(<ClerkTokenBridge />);
    const token = getClerkSessionToken();

    clerk.isLoaded = true;
    clerk.isSignedIn = true;
    clerk.signOut = vi.fn().mockResolvedValue(undefined);
    await act(async () => view.rerender(<ClerkTokenBridge />));

    await expect(token).resolves.toBe("clerk.jwt");
  });
});
