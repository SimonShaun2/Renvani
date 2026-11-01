import { beforeEach, describe, expect, it, vi } from "vitest";

import { featureFlags } from "@fsm/config/feature-flags";

import { verifyToken } from "@clerk/backend";

import { ErrorCode } from "@fsm/types";

import {
  extractClerkOrganizationId,
  isClerkAzpRequired,
  isClerkParallelAuthAvailable,
  verifyClerkBearerToken
} from "./clerk-auth.js";

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn()
}));

const flags = vi.hoisted(() => ({ clerkAuthParallelJwt: true, tenantSessionScopedWrites: false }));

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: flags,
  isClerkAuthParallelJwtEnabled: (source: Record<string, string | undefined> = process.env) =>
    source.RENVANI_DEPLOYMENT_TIER?.trim() === "staging"
}));

const mockEnv = vi.hoisted(() => ({
  CLERK_SECRET_KEY: "",
  CLERK_AUTHORIZED_PARTIES: "",
  NODE_ENV: "test",
  APP_URL: "https://app.example.com",
  APP_URL_ALLOWED: ""
}));
vi.mock("@fsm/config", () => ({ env: mockEnv }));

const AZP = "https://staging.example.com";

describe("clerk-auth", () => {
  beforeEach(() => {
    mockEnv.CLERK_SECRET_KEY = "";
    delete process.env.RENVANI_DEPLOYMENT_TIER;
    mockEnv.CLERK_AUTHORIZED_PARTIES = AZP;
    mockEnv.APP_URL_ALLOWED = "";
    flags.clerkAuthParallelJwt = true;
    vi.mocked(verifyToken).mockReset();
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
    mockEnv.CLERK_SECRET_KEY = "sk_test";
    expect(isClerkParallelAuthAvailable()).toBe(featureFlags.clerkAuthParallelJwt);
  });

  it("verifyClerkBearerToken maps Clerk payload to session (mocked verify)", async () => {
    mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
    vi.mocked(verifyToken).mockResolvedValue({
      sub: "user_clerk_1",
      org_id: "org_abc",
      azp: AZP,
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
    expect(verifyToken).toHaveBeenCalledWith("sess_mock_token", { secretKey: "sk_test_mock", authorizedParties: [AZP] });
  });

  it("verifyClerkBearerToken passes authorizedParties from env", async () => {
    mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
    mockEnv.CLERK_AUTHORIZED_PARTIES = "https://staging.example.com";
    vi.mocked(verifyToken).mockResolvedValue({ sub: "u", org_id: "o", azp: AZP } as never);
    await verifyClerkBearerToken("t");
    expect(verifyToken).toHaveBeenLastCalledWith("t", {
      secretKey: "sk_test_mock",
      authorizedParties: ["https://staging.example.com"]
    });
    mockEnv.CLERK_AUTHORIZED_PARTIES = "";
  });

  it("drops unverified emails and never reads role from unsafe_metadata", async () => {
    mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
    vi.mocked(verifyToken).mockResolvedValue({
      sub: "u",
      org_id: "o",
      azp: AZP,
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
    mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
    const previous = mockEnv.NODE_ENV;
    mockEnv.NODE_ENV = "production";
    mockEnv.CLERK_AUTHORIZED_PARTIES = "";
    try {
      await expect(verifyClerkBearerToken("t")).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
      expect(verifyToken).not.toHaveBeenCalled();
    } finally {
      mockEnv.NODE_ENV = previous;
    }
  });

  describe("FS-156 azp enforcement keyed off Clerk login, not NODE_ENV", () => {
    it("staging tier + empty CLERK_AUTHORIZED_PARTIES rejects (NODE_ENV=test)", async () => {
      mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
      process.env.RENVANI_DEPLOYMENT_TIER = "staging";
      mockEnv.CLERK_AUTHORIZED_PARTIES = "";
      await expect(verifyClerkBearerToken("t")).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
      expect(verifyToken).not.toHaveBeenCalled();
    });

    it("staging tier + matching azp passes", async () => {
      mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
      process.env.RENVANI_DEPLOYMENT_TIER = "staging";
      vi.mocked(verifyToken).mockResolvedValue({ sub: "u", org_id: "o", azp: `${AZP}/` } as never);
      await expect(verifyClerkBearerToken("t")).resolves.toMatchObject({ clerkUserId: "u" });
    });

    it("APP_URL_ALLOWED extras join authorized parties in staging only (exact match)", async () => {
      mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
      mockEnv.APP_URL_ALLOWED = "https://tester.example.com,https://*.vercel.app";
      process.env.RENVANI_DEPLOYMENT_TIER = "staging";
      vi.mocked(verifyToken).mockResolvedValue({ sub: "u", org_id: "o", azp: "https://tester.example.com" } as never);
      await expect(verifyClerkBearerToken("t")).resolves.toMatchObject({ clerkUserId: "u" });
      expect(verifyToken).toHaveBeenLastCalledWith("t", {
        secretKey: "sk_test_mock",
        authorizedParties: [AZP, "https://tester.example.com"]
      });

      vi.mocked(verifyToken).mockResolvedValue({ sub: "u", org_id: "o", azp: "https://foo.vercel.app" } as never);
      await expect(verifyClerkBearerToken("t")).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });

      process.env.RENVANI_DEPLOYMENT_TIER = "production";
      vi.mocked(verifyToken).mockResolvedValue({ sub: "u", org_id: "o", azp: "https://tester.example.com" } as never);
      await expect(verifyClerkBearerToken("t")).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
    });

    it("mismatched or missing azp rejects", async () => {
      mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
      process.env.RENVANI_DEPLOYMENT_TIER = "staging";
      vi.mocked(verifyToken).mockResolvedValue({ sub: "u", org_id: "o", azp: "https://evil.example.com" } as never);
      await expect(verifyClerkBearerToken("t")).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
      vi.mocked(verifyToken).mockResolvedValue({ sub: "u", org_id: "o" } as never);
      await expect(verifyClerkBearerToken("t")).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
      vi.mocked(verifyToken).mockRejectedValue(new Error("azp not allowed"));
      await expect(verifyClerkBearerToken("t")).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
    });

    it("azp is required for staging, production, or Clerk flag on; not for non-Clerk tiers", () => {
      flags.clerkAuthParallelJwt = false;
      expect(isClerkAzpRequired({ RENVANI_DEPLOYMENT_TIER: "staging", NODE_ENV: "development" })).toBe(true);
      expect(isClerkAzpRequired({ NODE_ENV: "production" })).toBe(true);
      expect(isClerkAzpRequired({ RENVANI_DEPLOYMENT_TIER: "dev", NODE_ENV: "development" })).toBe(false);
      expect(isClerkAzpRequired({ NODE_ENV: "test" })).toBe(false);
      flags.clerkAuthParallelJwt = true;
      expect(isClerkAzpRequired({ NODE_ENV: "test" })).toBe(true);
    });

    it("non-Clerk tiers are unaffected: Clerk path stays disabled, no azp check reached", async () => {
      flags.clerkAuthParallelJwt = false;
      mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
      mockEnv.CLERK_AUTHORIZED_PARTIES = "";
      expect(isClerkParallelAuthAvailable()).toBe(false);
      await expect(verifyClerkBearerToken("t")).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
      expect(verifyToken).not.toHaveBeenCalled();
    });
  });

  it("verifyClerkBearerToken rejects missing organization", async () => {
    mockEnv.CLERK_SECRET_KEY = "sk_test_mock";
    vi.mocked(verifyToken).mockResolvedValue({ sub: "user_clerk_1", azp: AZP } as never);

    await expect(verifyClerkBearerToken("sess_mock_token")).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });
});

describe("clerk-auth config source", () => {
  it("rejects with a handled error when CLERK_SECRET_KEY is unset (no crash)", async () => {
    mockEnv.CLERK_SECRET_KEY = "";
    process.env.CLERK_SECRET_KEY = "sk_test_from_process_env_ignored";
    try {
      expect(isClerkParallelAuthAvailable()).toBe(false);
      await expect(verifyClerkBearerToken("tok")).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    } finally {
      delete process.env.CLERK_SECRET_KEY;
    }
  });

  it("has no direct process.env reads", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./clerk-auth.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/process\.env/);
  });
});
