import { env } from "@fsm/config";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_SECONDS = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);

const bookingRequestTimesByIp = new Map<string, number[]>();
const slotHoldTimesByReference = new Map<string, number[]>();
const authRegisterTimesByIp = new Map<string, number[]>();
const authLoginTimesByIpEmail = new Map<string, number[]>();
const authRefreshTimesByIp = new Map<string, number[]>();
const authForgotPasswordTimesByIp = new Map<string, number[]>();

export const PUBLIC_BOOKING_IP_RATE_LIMIT = 10;
export const PUBLIC_SLOT_HOLD_REF_RATE_LIMIT = 15;
export const AUTH_REGISTER_IP_RATE_LIMIT = 5;
export const AUTH_LOGIN_RATE_LIMIT = 10;
export const AUTH_LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_REFRESH_IP_RATE_LIMIT = 60;
export const AUTH_FORGOT_PASSWORD_IP_RATE_LIMIT = 5;

function useInMemoryRateLimitStore(): boolean {
  return env.NODE_ENV === "test";
}

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

async function recordRedisAttempt(
  redisKey: string,
  limit: number,
  now: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): Promise<boolean> {
  const cutoff = now - windowMs;
  const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;
  const { redisConnection } = await import("@fsm/jobs");

  await redisConnection.zremrangebyscore(redisKey, 0, cutoff);
  const count = await redisConnection.zcard(redisKey);

  if (count >= limit) {
    return false;
  }

  await redisConnection.zadd(redisKey, now, member);
  await redisConnection.expire(redisKey, Math.ceil(windowMs / 1000) + 60);
  return true;
}

async function recordAttempt(
  map: Map<string, number[]>,
  redisKeyPrefix: string,
  identifier: string,
  limit: number,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): Promise<boolean> {
  const now = Date.now();

  if (useInMemoryRateLimitStore()) {
    return recordInMemoryAttempt(map, identifier, limit, now, windowMs);
  }

  const redisKey = `${redisKeyPrefix}:${identifier}`;

  try {
    return await recordRedisAttempt(redisKey, limit, now, windowMs);
  } catch {
    return recordInMemoryAttempt(map, identifier, limit, now, windowMs);
  }
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

export function resetPublicBookingRateLimitStateForTests(): void {
  authRegisterTimesByIp.clear();
  authLoginTimesByIpEmail.clear();
  authRefreshTimesByIp.clear();
  authForgotPasswordTimesByIp.clear();
  bookingRequestTimesByIp.clear();
  slotHoldTimesByReference.clear();
}

export function getRateLimitWindowMs(): number {
  return RATE_LIMIT_WINDOW_MS;
}
