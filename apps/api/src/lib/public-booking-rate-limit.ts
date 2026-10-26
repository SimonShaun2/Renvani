import { env } from "@fsm/config";

import {
  evalRateLimitScript,
  hitFixedWindowRateLimit,
  normalizeRateLimitIp,
  resetFixedWindowRateLimitStateForTests,
  resolveRateLimitRedisClient
} from "./fixed-window-rate-limit.js";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_SECONDS = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);

const bookingRequestTimesByIp = new Map<string, number[]>();
const slotHoldTimesByReference = new Map<string, number[]>();
const authRegisterTimesByIp = new Map<string, number[]>();
const authLoginTimesByIpEmail = new Map<string, number[]>();
const authLoginTimesByIp = new Map<string, number[]>();
const authRefreshTimesByIp = new Map<string, number[]>();
const authForgotPasswordTimesByIp = new Map<string, number[]>();
const signupAttemptNoticeTimesByEmail = new Map<string, number[]>();

export const PUBLIC_BOOKING_IP_RATE_LIMIT = 10;
export const PUBLIC_SLOT_HOLD_REF_RATE_LIMIT = 15;
export const AUTH_REGISTER_IP_RATE_LIMIT = 5;
export const AUTH_LOGIN_RATE_LIMIT = 10;
export const AUTH_LOGIN_IP_RATE_LIMIT = 30;
export const AUTH_LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_REFRESH_IP_RATE_LIMIT = 60;
export const AUTH_FORGOT_PASSWORD_IP_RATE_LIMIT = 5;
/** At most one "someone tried to sign up with your email" notice per recipient per window. */
export const AUTH_SIGNUP_ATTEMPT_NOTICE_LIMIT = 1;
export const AUTH_SIGNUP_ATTEMPT_NOTICE_WINDOW_MS = 60 * 60 * 1000;

function recordInMemoryAttempt(
  map: Map<string, number[]>,
  key: string,
  limit: number,
  now: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): boolean {
  const cutoff = now - windowMs;
  const requestTimes = map.get(key) ?? [];
  const activeTimes = requestTimes.filter((timestamp) => timestamp > cutoff);

  if (activeTimes.length >= limit) {
    return false;
  }

  activeTimes.push(now);
  map.set(key, activeTimes);
  return true;
}

/**
 * FS-155 follow-up: sliding-window check-and-add as ONE Lua script, so concurrent requests can't all pass
 * a zcard-then-zadd race. ARGV: cutoff, now, limit, member, ttlMs. Returns 1 if recorded (allowed), else 0.
 */
export const SLIDING_WINDOW_LUA = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return 1
`;

async function recordAttempt(
  map: Map<string, number[]>,
  redisKeyPrefix: string,
  identifier: string,
  limit: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): Promise<boolean> {
  const now = Date.now();
  // Same resolution as the #193 fixed-window limiter: null under NODE_ENV=test unless a test injects a client.
  const client = await resolveRateLimitRedisClient().catch(() => null);
  if (client) {
    const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
    const ttlMs = (Math.ceil(windowMs / 1000) + 60) * 1000;
    try {
      const reply = await evalRateLimitScript(
        client,
        SLIDING_WINDOW_LUA,
        `${redisKeyPrefix}:${identifier}`,
        now - windowMs,
        now,
        limit,
        member,
        ttlMs
      );
      if (reply === 1 || reply === "1") return true;
      if (reply === 0 || reply === "0") return false;
      throw new Error("unexpected rate-limit redis reply");
    } catch {
      // Redis down/slow (250 ms) or bad reply: fall through to the per-process in-memory window.
    }
  }
  return recordInMemoryAttempt(map, identifier, limit, now, windowMs);
}

export async function checkPublicBookingIpRateLimit(ipAddress: string): Promise<boolean> {
  const normalizedIp = ipAddress.trim().length > 0 ? ipAddress.trim() : "unknown";
  return recordAttempt(
    bookingRequestTimesByIp,
    "fsm:public-booking:rate:ip",
    normalizedIp,
    PUBLIC_BOOKING_IP_RATE_LIMIT
  );
}

export async function checkPublicSlotHoldReferenceRateLimit(slug: string, reference: string): Promise<boolean> {
  const key = `${slug.trim()}:${reference.trim()}`;
  return recordAttempt(
    slotHoldTimesByReference,
    "fsm:public-booking:rate:slot-hold-ref",
    key,
    PUBLIC_SLOT_HOLD_REF_RATE_LIMIT
  );
}

export async function checkAuthRegisterIpRateLimit(ipAddress: string): Promise<boolean> {
  const normalizedIp = ipAddress.trim().length > 0 ? ipAddress.trim() : "unknown";
  return recordAttempt(authRegisterTimesByIp, "fsm:auth-register:rate:ip", normalizedIp, AUTH_REGISTER_IP_RATE_LIMIT);
}

function normalizeIp(ipAddress: string): string {
  return ipAddress.trim().length > 0 ? ipAddress.trim() : "unknown";
}

export async function checkAuthLoginRateLimit(ipAddress: string, email: string): Promise<boolean> {
  const key = `${normalizeIp(ipAddress)}:${email.trim().toLowerCase()}`;
  return recordAttempt(authLoginTimesByIpEmail, "fsm:auth-login:rate:ip-email", key, AUTH_LOGIN_RATE_LIMIT, AUTH_LOGIN_WINDOW_MS);
}

export async function checkAuthLoginIpRateLimit(ipAddress: string): Promise<boolean> {
  return recordAttempt(authLoginTimesByIp, "fsm:auth-login:rate:ip", normalizeIp(ipAddress), AUTH_LOGIN_IP_RATE_LIMIT, AUTH_LOGIN_WINDOW_MS);
}

export async function checkAuthRefreshIpRateLimit(ipAddress: string): Promise<boolean> {
  return recordAttempt(authRefreshTimesByIp, "fsm:auth-refresh:rate:ip", normalizeIp(ipAddress), AUTH_REFRESH_IP_RATE_LIMIT);
}

export async function checkAuthForgotPasswordIpRateLimit(ipAddress: string): Promise<boolean> {
  return recordAttempt(
    authForgotPasswordTimesByIp,
    "fsm:auth-forgot-password:rate:ip",
    normalizeIp(ipAddress),
    AUTH_FORGOT_PASSWORD_IP_RATE_LIMIT
  );
}

/** Per-recipient cooldown so an attacker cannot flood a victim with signup-attempt notices. */
export async function checkSignupAttemptNoticeCooldown(email: string): Promise<boolean> {
  return recordAttempt(
    signupAttemptNoticeTimesByEmail,
    "fsm:auth-signup-attempt-notice:rate:email",
    email.trim().toLowerCase(),
    AUTH_SIGNUP_ATTEMPT_NOTICE_LIMIT,
    AUTH_SIGNUP_ATTEMPT_NOTICE_WINDOW_MS
  );
}

export function resetPublicBookingRateLimitStateForTests(): void {
  signupAttemptNoticeTimesByEmail.clear();
  authRegisterTimesByIp.clear();
  authLoginTimesByIpEmail.clear();
  authLoginTimesByIp.clear();
  authRefreshTimesByIp.clear();
  authForgotPasswordTimesByIp.clear();
  bookingRequestTimesByIp.clear();
  slotHoldTimesByReference.clear();
  resetFixedWindowRateLimitStateForTests();
}

export function getRateLimitWindowMs(): number {
  return RATE_LIMIT_WINDOW_MS;
}

/**
 * FS-66 — dedicated public slot-hold/confirm limits (atomic fixed window, Redis + memory fallback).
 * Per client IP and per company booking slug; values are env-configurable.
 */
export async function checkPublicSlotHoldIpAndCompanyRateLimit(
  ipAddress: string,
  slug: string
): Promise<{ allowed: true } | { allowed: false; scope: "ip" | "company"; retryAfterSeconds: number }> {
  const windowMs = env.PUBLIC_SLOT_HOLD_RATE_LIMIT_WINDOW_SECONDS * 1000;
  const ip = await hitFixedWindowRateLimit({
    key: `fsm:public-booking:rate:slot-hold-ip:${normalizeRateLimitIp(ipAddress)}`,
    limit: env.PUBLIC_SLOT_HOLD_IP_RATE_LIMIT_MAX,
    windowMs
  });
  if (!ip.allowed) {
    return { allowed: false, scope: "ip", retryAfterSeconds: ip.retryAfterSeconds };
  }
  const company = await hitFixedWindowRateLimit({
    key: `fsm:public-booking:rate:slot-hold-company:${slug.trim().toLowerCase()}`,
    limit: env.PUBLIC_SLOT_HOLD_COMPANY_RATE_LIMIT_MAX,
    windowMs
  });
  if (!company.allowed) {
    return { allowed: false, scope: "company", retryAfterSeconds: company.retryAfterSeconds };
  }
  return { allowed: true };
}
