import { describe, expect, it, beforeEach } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";
import {
  PUBLIC_BOOKING_IP_RATE_LIMIT,
  PUBLIC_SLOT_HOLD_REF_RATE_LIMIT,
  checkPublicBookingIpRateLimit,
  checkPublicSlotHoldReferenceRateLimit,
  resetPublicBookingRateLimitStateForTests
} from "./public-booking-rate-limit.js";

setupTestEnv();

describe("public-booking-rate-limit (in-memory test store)", () => {
  beforeEach(() => {
    resetPublicBookingRateLimitStateForTests();
  });

  it("limits booking submissions per IP", async () => {
    for (let attempt = 0; attempt < PUBLIC_BOOKING_IP_RATE_LIMIT; attempt += 1) {
      await expect(checkPublicBookingIpRateLimit("203.0.113.10")).resolves.toBe(true);
    }

    await expect(checkPublicBookingIpRateLimit("203.0.113.10")).resolves.toBe(false);
  });

  it("limits slot-hold attempts per slug and reference", async () => {
    for (let attempt = 0; attempt < PUBLIC_SLOT_HOLD_REF_RATE_LIMIT; attempt += 1) {
      await expect(checkPublicSlotHoldReferenceRateLimit("acme", "BK-REF-001")).resolves.toBe(true);
    }

    await expect(checkPublicSlotHoldReferenceRateLimit("acme", "BK-REF-001")).resolves.toBe(false);
  });
});

describe("auth register rate limit", () => {
  it("blocks after the limit per IP", async () => {
    const mod = await import("./public-booking-rate-limit.js");
    mod.resetPublicBookingRateLimitStateForTests();
    for (let i = 0; i < mod.AUTH_REGISTER_IP_RATE_LIMIT; i += 1) {
      await expect(mod.checkAuthRegisterIpRateLimit("198.51.100.7")).resolves.toBe(true);
    }
    await expect(mod.checkAuthRegisterIpRateLimit("198.51.100.7")).resolves.toBe(false);
    mod.resetPublicBookingRateLimitStateForTests();
  });
});

describe("auth login/refresh/forgot-password rate limits", () => {
  it("enforces each limit and keys login on IP+email", async () => {
    const mod = await import("./public-booking-rate-limit.js");
    mod.resetPublicBookingRateLimitStateForTests();
    for (let i = 0; i < mod.AUTH_LOGIN_RATE_LIMIT; i += 1) {
      await expect(mod.checkAuthLoginRateLimit("198.51.100.8", "A@x.com")).resolves.toBe(true);
    }
    await expect(mod.checkAuthLoginRateLimit("198.51.100.8", "a@x.com")).resolves.toBe(false);
    await expect(mod.checkAuthLoginRateLimit("198.51.100.8", "b@x.com")).resolves.toBe(true);
    for (let i = 0; i < mod.AUTH_REFRESH_IP_RATE_LIMIT; i += 1) {
      await expect(mod.checkAuthRefreshIpRateLimit("198.51.100.9")).resolves.toBe(true);
    }
    await expect(mod.checkAuthRefreshIpRateLimit("198.51.100.9")).resolves.toBe(false);
    for (let i = 0; i < mod.AUTH_FORGOT_PASSWORD_IP_RATE_LIMIT; i += 1) {
      await expect(mod.checkAuthForgotPasswordIpRateLimit("198.51.100.10")).resolves.toBe(true);
    }
    await expect(mod.checkAuthForgotPasswordIpRateLimit("198.51.100.10")).resolves.toBe(false);
    mod.resetPublicBookingRateLimitStateForTests();
  });
});
