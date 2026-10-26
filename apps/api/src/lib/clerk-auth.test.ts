import { beforeEach, describe, expect, it, vi } from "vitest";

import { featureFlags } from "@fsm/config/feature-flags";

import { verifyToken } from "@clerk/backend";

import { ErrorCode } from "@fsm/types";

import {
  extractClerkOrganizationId,
  isClerkParallelAuthAvailable,
  verifyClerkBearerToken
} from "./clerk-auth.js";

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn()
}));

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: {
    clerkAuthParallelJwt: true,
    tenantSessionScopedWrites: false
  }
}));

describe("clerk-auth", () => {
  beforeEach(() => {
    delete process.env.CLERK_SECRET_KEY;
  });

  it("is disabled without secret and flag", () => {
    expect(isClerkParallelAuthAvailable()).toBe(false);
  });

  it("extracts organization id from claims", () => {
    expect(extractClerkOrganizationId({ org_id: "org_abc" })).toBe("org_abc");
    expect(extractClerkOrganizationId({ o: { id: "org_nested" } })).toBe("org_nested");
    expect(extractClerkOrganizationId({})).toBeNull();
  });

  it("requires flag when secret is set", () => {
    process.env.CLERK_SECRET_KEY = "sk_test";
    expect(isClerkParallelAuthAvailable()).toBe(featureFlags.clerkAuthParallelJwt);
  });

  it("verifyClerkBearerToken maps Clerk payload to session (mocked verify)", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_mock";
    vi.mocked(verifyToken).mockResolvedValue({
      sub: "user_clerk_1",
      org_id: "org_abc",
      email: "Staff@example.com",
      email_verified: true,
      metadata: { role: "admin" }
    } as never);

    const session = await verifyClerkBearerToken("sess_mock_token");
    expect(session).toEqual({
      clerkUserId: "user_clerk_1",
      clerkOrganizationId: "org_abc",
      email: "staff@example.com",
      role: "admin"
    });
    expect(verifyToken).toHaveBeenCalledWith("sess_mock_token", { secretKey: "sk_test_mock" });
  });

  it("verifyClerkBearerToken passes authorizedParties from env", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_mock";
    process.env.CLERK_AUTHORIZED_PARTIES = "https://staging.example.com";
    vi.mocked(verifyToken).mockResolvedValue({ sub: "u", org_id: "o" } as never);
    await verifyClerkBearerToken("t");
    expect(verifyToken).toHaveBeenLastCalledWith("t", {
      secretKey: "sk_test_mock",
      authorizedParties: ["https://staging.example.com"]
    });
    delete process.env.CLERK_AUTHORIZED_PARTIES;
  });

  it("drops unverified emails and never reads role from unsafe_metadata", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_mock";
    vi.mocked(verifyToken).mockResolvedValue({
      sub: "u",
      org_id: "o",
      email: "x@example.com",
      email_verified: false,
      unsafe_metadata: { role: "owner" },
      renvani_role: "owner"
    } as never);
    const session = await verifyClerkBearerToken("t");
    expect(session.email).toBeNull();
    expect(session.role).toBeNull();
  });

  it("fails closed in production when CLERK_AUTHORIZED_PARTIES is empty", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_mock";
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    vi.mocked(verifyToken).mockClear();
    try {
      await expect(verifyClerkBearerToken("t")).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
      expect(verifyToken).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("verifyClerkBearerToken rejects missing organization", async () => {
    process.env.CLERK_SECRET_KEY = "sk_test_mock";
    vi.mocked(verifyToken).mockResolvedValue({ sub: "user_clerk_1" } as never);

    await expect(verifyClerkBearerToken("sess_mock_token")).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });
});
