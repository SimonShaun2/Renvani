import { hash as hashPassword } from "bcryptjs";

vi.mock("bcryptjs", async () => {
  const actual = await vi.importActual<typeof import("bcryptjs")>("bcryptjs");
  return { ...actual, hash: vi.fn(actual.hash) };
});
import jwt from "jsonwebtoken";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError, ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

const notificationsQueueAddMock = vi.hoisted(() => vi.fn());
const emailMocks = vi.hoisted(() => ({
  sendVerifyEmailEmail: vi.fn(async () => undefined),
  sendSignupAttemptEmail: vi.fn(async () => undefined)
}));
const TEST_JWT_SECRET = "jwt_secret";
const TEST_JWT_REFRESH_SECRET = "jwt_refresh_secret";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  notificationsQueue: {
    add: notificationsQueueAddMock
  }
}));

vi.mock("../lib/email.js", () => emailMocks);

async function flushBackground(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

type AuthServiceModule = typeof import("./auth.service.js");
type CompanyServiceModule = typeof import("./company.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");
type TokensModule = typeof import("../lib/tokens.js");
type CompanyUpdateInput = Parameters<CompanyServiceModule["updateCompany"]>[2];

let authService: AuthServiceModule;
let companyService: CompanyServiceModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;

beforeAll(async () => {
  authService = await import("./auth.service.js");
  companyService = await import("./company.service.js");
  fakeDb = await import("../test-support/fake-db.js");
  tokens = await import("../lib/tokens.js");
  rateLimit = await import("../lib/public-booking-rate-limit.js");
});

let rateLimit: typeof import("../lib/public-booking-rate-limit.js");

beforeEach(() => {
  fakeDb.resetTestState();
  notificationsQueueAddMock.mockReset();
  emailMocks.sendVerifyEmailEmail.mockClear();
  emailMocks.sendSignupAttemptEmail.mockClear();
  rateLimit.resetPublicBookingRateLimitStateForTests();
  vi.useRealTimers();
});

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

describe("auth.service", () => {
  it("register sends a verify email (fire-and-forget) and stores only the token hash", async () => {
    const result = await authService.register({
      companyName: "Verify Co",
      firstName: "Ava",
      lastName: "Stone",
      email: "verify@example.com",
      password: "password123",
      timezone: "America/Chicago"
    });
    if (result.status !== "created") throw new Error("expected created");
    expect(emailMocks.sendVerifyEmailEmail).not.toHaveBeenCalled();
    await flushBackground();
    expect(emailMocks.sendVerifyEmailEmail).toHaveBeenCalledTimes(1);
    const [to, url, firstName] = emailMocks.sendVerifyEmailEmail.mock.calls[0] as unknown as [string, string, string];
    expect(to).toBe("verify@example.com");
    expect(firstName).toBe("Ava");
    const token = decodeURIComponent(new URL(url).searchParams.get("token") ?? "");
    expect(url).toContain("/verify-email?token=");

    const stored = fakeDb.getTestState().users.find((u) => u.id === result.user.id);
    expect(stored?.emailVerificationTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.emailVerificationTokenHash).not.toContain(token);
    const ttl = (stored?.emailVerificationExpiresAt?.getTime() ?? 0) - Date.now();
    expect(ttl).toBeGreaterThan(23.9 * 3600 * 1000);
    expect(ttl).toBeLessThanOrEqual(24 * 3600 * 1000);

    const verified = await authService.verifyEmail(token);
    expect(verified.user.id).toBe(result.user.id);
    expect(verified.user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(verified.tokens.accessToken).toEqual(expect.any(String));
    expect(verified.tokens.refreshToken).toEqual(expect.any(String));

    // single use
    await expect(authService.verifyEmail(token)).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
  });

  it("verifyEmail rejects unknown and expired tokens", async () => {
    await expect(authService.verifyEmail("nope")).rejects.toBeInstanceOf(AppError);
    const result = await authService.register({
      companyName: "Expired Co",
      firstName: "Ava",
      lastName: "Stone",
      email: "expired@example.com",
      password: "password123",
      timezone: "America/Chicago"
    });
    if (result.status !== "created") throw new Error("expected created");
    await flushBackground();
    const url = (emailMocks.sendVerifyEmailEmail.mock.calls[0] as unknown as [string, string])[1];
    const token = decodeURIComponent(new URL(url).searchParams.get("token") ?? "");
    const stored = fakeDb.getTestState().users.find((u) => u.id === result.user.id);
    if (!stored) throw new Error("missing user");
    stored.emailVerificationExpiresAt = new Date(Date.now() - 1000);
    await expect(authService.verifyEmail(token)).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED });
  });

  it("register with an existing email notifies the owner (fire-and-forget)", async () => {
    const company = fakeDb.seedCompany({ name: "Acme2", slug: "acme2" });
    fakeDb.seedUser({ companyId: company.id, email: "taken@example.com", firstName: "Pat", lastName: "Lee" });
    await expect(
      authService.register({
        companyName: "Other",
        firstName: "Sam",
        lastName: "Hill",
        email: "Taken@example.com",
        password: "password123",
        timezone: "America/Chicago"
      })
    ).resolves.toEqual({ status: "existing" });
    await flushBackground();
    expect(emailMocks.sendSignupAttemptEmail).toHaveBeenCalledWith(
      "taken@example.com",
      expect.objectContaining({ firstName: "Pat", loginUrl: expect.stringContaining("/login") })
    );
    expect(emailMocks.sendVerifyEmailEmail).not.toHaveBeenCalled();
  });

  it("sends at most one signup-attempt notice per recipient per cooldown window", async () => {
    const company = fakeDb.seedCompany({ name: "Acme3", slug: "acme3" });
    fakeDb.seedUser({ companyId: company.id, email: "victim@example.com", firstName: "Vic", lastName: "Tim" });
    for (let i = 0; i < 3; i += 1) {
      await expect(
        authService.register({
          companyName: "Spam",
          firstName: "A",
          lastName: "B",
          email: "Victim@example.com",
          password: "password123",
          timezone: "America/Chicago"
        })
      ).resolves.toEqual({ status: "existing" });
      await flushBackground();
    }
    expect(emailMocks.sendSignupAttemptEmail).toHaveBeenCalledTimes(1);
  });

  it("registers a company, owner, and hashed refresh token", async () => {
    const result = await authService.register({
      companyName: "Tulsa HVAC Pro",
      firstName: "Ava",
      lastName: "Stone",
      email: "owner@example.com",
      password: "password123",
      phone: "555-0100",
      timezone: "America/Chicago"
    });

    const state = fakeDb.getTestState();
    if (result.status !== "created") throw new Error("expected created");

    expect(result.company.slug).toBe("tulsa-hvac-pro");
    expect(result.user.role).toBe("owner");
    expect(result.user.passwordHash).not.toBe("password123");
    expect(state.refreshTokens).toHaveLength(0);
    expect(state.activityEvents.map((event) => event.eventType)).toEqual([
      "company.created",
      "user.registered"
    ]);
  });

  it("returns existing (no error) for a duplicate register email", async () => {
    vi.mocked(hashPassword).mockClear();
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      firstName: "Pat",
      lastName: "Lee"
    });

    await expect(
      authService.register({
        companyName: "Other Co",
        firstName: "Sam",
        lastName: "Hill",
        email: "owner@example.com",
        password: "password123",
        timezone: "America/Chicago"
      })
    ).resolves.toEqual({ status: "existing" });
    expect(vi.mocked(hashPassword)).toHaveBeenCalledWith("password123", 12);
  });

  it("register normalizes email casing", async () => {
    const result = await authService.register({
      companyName: "Case Check Co",
      firstName: "Sam",
      lastName: "Hill",
      email: "SAM@EXAMPLE.COM",
      password: "password123",
      timezone: "America/Chicago"
    });

    if (result.status !== "created") throw new Error("expected created");
    expect(result.user.email).toBe("sam@example.com");
  });

  it("logs in with correct credentials", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("password123", 12),
      firstName: "Pat",
      lastName: "Lee",
      role: "owner"
    });

    const result = await authService.login({
      email: "owner@example.com",
      password: "password123"
    });

    const state = fakeDb.getTestState();
    const storedRefreshToken = requireValue(state.refreshTokens[0], "Expected a stored refresh token");

    expect(result.user.id).toBe(user.id);
    expect(state.refreshTokens).toHaveLength(1);
    expect(await tokens.compareToken(result.tokens.refreshToken, storedRefreshToken.tokenHash)).toBe(true);
    expect(state.activityEvents.map((event) => event.eventType)).toEqual(["user.login"]);
  });

  it("returns the same login error for wrong email and wrong password", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("password123", 12),
      firstName: "Pat",
      lastName: "Lee"
    });

    const getLoginError = async (email: string, password: string) => {
      try {
        await authService.login({ email, password });
        throw new Error("Expected login to fail");
      } catch (error) {
        return error as AppError;
      }
    };

    const wrongEmailError = await getLoginError("missing@example.com", "password123");
    const wrongPasswordError = await getLoginError("owner@example.com", "wrong-password");

    expect(wrongEmailError.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(wrongPasswordError.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(wrongEmailError.message).toBe(wrongPasswordError.message);
  });

  it("refreshes a valid refresh token and revokes the old one", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("password123", 12),
      firstName: "Pat",
      lastName: "Lee",
      role: "owner"
    });
    const refreshToken = tokens.generateRefreshToken({
      userId: user.id,
      companyId: company.id
    });

    fakeDb.seedRefreshToken({
      companyId: company.id,
      userId: user.id,
      tokenHash: await tokens.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 60_000)
    });

    const result = await authService.refresh(refreshToken);
    const state = fakeDb.getTestState();
    const revokedRefreshToken = requireValue(state.refreshTokens[0], "Expected the original refresh token");
    const replacementRefreshToken = requireValue(state.refreshTokens[1], "Expected a replacement refresh token");

    expect(state.refreshTokens).toHaveLength(2);
    expect(revokedRefreshToken.revokedAt).toBeInstanceOf(Date);
    expect(await tokens.compareToken(result.tokens.refreshToken, replacementRefreshToken.tokenHash)).toBe(true);
  });

  it("rejects an expired refresh token", async () => {
    const refreshToken = jwt.sign(
      {
        userId: "user-1",
        companyId: "company-1",
        tokenType: "refresh"
      },
      TEST_JWT_REFRESH_SECRET,
      { expiresIn: -1 }
    );

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });

  it("rejects login for inactive users", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("password123", 12),
      firstName: "Pat",
      lastName: "Lee",
      isActive: false
    });

    await expect(
      authService.login({
        email: "owner@example.com",
        password: "password123"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });

  it("rejects refresh for inactive users", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("password123", 12),
      firstName: "Pat",
      lastName: "Lee",
      isActive: false
    });
    const refreshToken = tokens.generateRefreshToken({
      userId: user.id,
      companyId: company.id
    });

    fakeDb.seedRefreshToken({
      companyId: company.id,
      userId: user.id,
      tokenHash: await tokens.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 60_000)
    });

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });

  it("rejects a revoked refresh token", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("password123", 12),
      firstName: "Pat",
      lastName: "Lee"
    });
    const refreshToken = tokens.generateRefreshToken({
      userId: user.id,
      companyId: company.id
    });

    fakeDb.seedRefreshToken({
      companyId: company.id,
      userId: user.id,
      tokenHash: await tokens.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date()
    });

    await expect(authService.refresh(refreshToken)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });

  it("revokes the token on logout", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("password123", 12),
      firstName: "Pat",
      lastName: "Lee"
    });
    const refreshToken = tokens.generateRefreshToken({
      userId: user.id,
      companyId: company.id
    });

    fakeDb.seedRefreshToken({
      companyId: company.id,
      userId: user.id,
      tokenHash: await tokens.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 60_000)
    });

    await authService.logout(refreshToken);

    const state = fakeDb.getTestState();
    const storedRefreshToken = requireValue(state.refreshTokens[0], "Expected a stored refresh token");
    expect(storedRefreshToken.revokedAt).toBeInstanceOf(Date);
  });

  it("returns void for existing and nonexistent forgot-password requests", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("password123", 12),
      firstName: "Pat",
      lastName: "Lee"
    });

    notificationsQueueAddMock.mockResolvedValue(undefined);

    await expect(authService.forgotPassword("owner@example.com")).resolves.toBeUndefined();
    await expect(authService.forgotPassword("missing@example.com")).resolves.toBeUndefined();
    expect(notificationsQueueAddMock).toHaveBeenCalledTimes(1);
    expect(notificationsQueueAddMock).toHaveBeenCalledWith(
      "send-password-reset-email",
      expect.objectContaining({
        toEmail: "owner@example.com",
        firstName: "Pat"
      })
    );
  });

  it("swallows enqueue failures in forgot-password", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("password123", 12),
      firstName: "Pat",
      lastName: "Lee"
    });

    notificationsQueueAddMock.mockRejectedValue(new Error("Redis down"));

    await expect(authService.forgotPassword("owner@example.com")).resolves.toBeUndefined();
  });

  it("resets a password successfully", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("old-password", 12),
      firstName: "Pat",
      lastName: "Lee",
      passwordChangedAt: null
    });
    const refreshToken = tokens.generateRefreshToken({
      userId: user.id,
      companyId: company.id
    });
    const previousPasswordHash = user.passwordHash;

    fakeDb.seedRefreshToken({
      companyId: company.id,
      userId: user.id,
      tokenHash: await tokens.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 60_000)
    });

    const resetToken = tokens.generateResetToken({
      userId: user.id,
      email: user.email
    });

    await authService.resetPassword(resetToken, "new-password123");

    const state = fakeDb.getTestState();
    const storedUser = requireValue(state.users[0], "Expected the reset user");
    const storedRefreshToken = requireValue(state.refreshTokens[0], "Expected the revoked refresh token");
    expect(storedUser.passwordChangedAt).toBeInstanceOf(Date);
    expect(storedUser.passwordHash).not.toBe(previousPasswordHash);
    expect(storedRefreshToken.revokedAt).toBeInstanceOf(Date);
  });

  it("rejects a reset-token replay attempt", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("old-password", 12),
      firstName: "Pat",
      lastName: "Lee",
      passwordChangedAt: null
    });
    const resetToken = tokens.generateResetToken({
      userId: user.id,
      email: user.email
    });

    await authService.resetPassword(resetToken, "new-password123");

    await expect(authService.resetPassword(resetToken, "another-password123")).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });

  it("rejects an expired reset token", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      passwordHash: await hashPassword("old-password", 12),
      firstName: "Pat",
      lastName: "Lee"
    });
    const resetToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        tokenType: "reset"
      },
      TEST_JWT_SECRET,
      { expiresIn: -1 }
    );

    await expect(authService.resetPassword(resetToken, "new-password123")).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED
    });
  });
});

describe("company.service", () => {
  it("gets a company successfully", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });

    const result = await companyService.getCompany(company.id);

    expect(result.id).toBe(company.id);
  });

  it("throws not found for a missing company", async () => {
    await expect(companyService.getCompany("missing-company")).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });

  it("updates allowed company fields", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      firstName: "Pat",
      lastName: "Lee"
    });

    const result = await companyService.updateCompany(company.id, user.id, {
      name: "Acme HVAC",
      website: "https://example.com"
    });

    expect(result.name).toBe("Acme HVAC");
    expect(result.website).toBe("https://example.com");
  });

  it("returns the existing company when no supported fields are provided", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      firstName: "Pat",
      lastName: "Lee"
    });

    const result = await companyService.updateCompany(company.id, user.id, {} as CompanyUpdateInput);

    expect(result.id).toBe(company.id);
    expect(result.name).toBe(company.name);
  });
});
