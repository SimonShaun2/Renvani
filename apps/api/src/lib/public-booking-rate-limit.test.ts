import { describe, expect, it, beforeEach } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";
import { setRateLimitRedisClientForTests } from "./fixed-window-rate-limit.js";
import {
  AUTH_SIGNUP_ATTEMPT_NOTICE_LIMIT,
  AUTH_SIGNUP_ATTEMPT_NOTICE_WINDOW_MS,
  PUBLIC_BOOKING_IP_RATE_LIMIT,
  SLIDING_WINDOW_LUA,
  checkSignupAttemptNoticeCooldown,
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

describe("auth login per-IP cap", () => {
  it("blocks an IP after 30 logins across different emails", async () => {
    const mod = await import("./public-booking-rate-limit.js");
    mod.resetPublicBookingRateLimitStateForTests();
    for (let i = 0; i < mod.AUTH_LOGIN_IP_RATE_LIMIT; i += 1) {
      await expect(mod.checkAuthLoginIpRateLimit("198.51.100.11")).resolves.toBe(true);
    }
    await expect(mod.checkAuthLoginIpRateLimit("198.51.100.11")).resolves.toBe(false);
    await expect(mod.checkAuthLoginIpRateLimit("198.51.100.12")).resolves.toBe(true);
    mod.resetPublicBookingRateLimitStateForTests();
  });
});

describe("FS-155 follow-up: atomic sliding-window cooldown (Redis path)", () => {
  /**
   * Fake Redis: like real Redis, each EVAL runs to completion before the next one (scripts are atomic). The
   * `await` before running lets concurrent callers interleave at the network boundary, as they would in prod.
   */
  function fakeRedis() {
    const zsets = new Map<string, Map<string, number>>();
    const calls: Array<{ script: string; key: string; args: Array<string | number> }> = [];
    const client = {
      async eval(script: string, _numKeys: number, ...rest: Array<string | number>): Promise<unknown> {
        const [key, ...args] = rest as [string, ...Array<string | number>];
        calls.push({ script, key, args });
        await new Promise((resolve) => setImmediate(resolve));
        const [cutoff, now, limit, member] = args as [number, number, number, string];
        const set = zsets.get(key) ?? new Map<string, number>();
        for (const [m, score] of set) if (score <= cutoff) set.delete(m);
        if (set.size >= limit) return 0;
        set.set(member, now);
        zsets.set(key, set);
        return 1;
      }
    };
    return { client, calls };
  }

  beforeEach(() => {
    resetPublicBookingRateLimitStateForTests();
  });

  it("allows exactly the limit under concurrent calls, with one atomic EVAL per attempt", async () => {
    const { client, calls } = fakeRedis();
    setRateLimitRedisClientForTests(client);
    const results = await Promise.all(
      Array.from({ length: 25 }, () => checkSignupAttemptNoticeCooldown("victim@example.com"))
    );
    expect(results.filter(Boolean)).toHaveLength(AUTH_SIGNUP_ATTEMPT_NOTICE_LIMIT);
    expect(calls).toHaveLength(25);
    expect(calls.every((c) => c.script === SLIDING_WINDOW_LUA && c.key === "fsm:auth-signup-attempt-notice:rate:email:victim@example.com")).toBe(true);

    const booking = await Promise.all(Array.from({ length: 30 }, () => checkPublicBookingIpRateLimit("203.0.113.7")));
    expect(booking.filter(Boolean)).toHaveLength(PUBLIC_BOOKING_IP_RATE_LIMIT);
  });

  it("passes cutoff, now, limit, member and a window+60s TTL to the script", async () => {
    const { client, calls } = fakeRedis();
    setRateLimitRedisClientForTests(client);
    await checkSignupAttemptNoticeCooldown("A@Example.com ");
    const [cutoff, now, limit, member, ttlMs] = calls[0]!.args as [number, number, number, string, number];
    expect(calls[0]!.key).toBe("fsm:auth-signup-attempt-notice:rate:email:a@example.com");
    expect(now - cutoff).toBe(AUTH_SIGNUP_ATTEMPT_NOTICE_WINDOW_MS);
    expect(limit).toBe(AUTH_SIGNUP_ATTEMPT_NOTICE_LIMIT);
    expect(member).toMatch(/^\d+:[a-z0-9]+$/);
    expect(ttlMs).toBe(AUTH_SIGNUP_ATTEMPT_NOTICE_WINDOW_MS + 60_000);
  });

  it("falls back to the in-memory window when Redis errors, and still enforces the limit", async () => {
    setRateLimitRedisClientForTests({ eval: () => Promise.reject(new Error("ECONNREFUSED")) });
    await expect(checkSignupAttemptNoticeCooldown("down@example.com")).resolves.toBe(true);
    await expect(checkSignupAttemptNoticeCooldown("down@example.com")).resolves.toBe(false);
  });

  it("falls back to memory when Redis hangs past the 250 ms timeout", async () => {
    setRateLimitRedisClientForTests({ eval: () => new Promise(() => undefined) });
    const started = Date.now();
    await expect(checkSignupAttemptNoticeCooldown("slow@example.com")).resolves.toBe(true);
    expect(Date.now() - started).toBeGreaterThanOrEqual(240);
    expect(Date.now() - started).toBeLessThan(2_000);
    await expect(checkSignupAttemptNoticeCooldown("slow@example.com")).resolves.toBe(false);
  });

  it("treats an unexpected Redis reply as unavailable (memory fallback)", async () => {
    setRateLimitRedisClientForTests({ eval: () => Promise.resolve("OK") });
    await expect(checkSignupAttemptNoticeCooldown("odd@example.com")).resolves.toBe(true);
    await expect(checkSignupAttemptNoticeCooldown("odd@example.com")).resolves.toBe(false);
  });
});
