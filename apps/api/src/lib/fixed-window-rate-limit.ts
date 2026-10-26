import { env } from "@fsm/config";

/**
 * FS-66 — atomic fixed-window rate limiter.
 *
 * Redis path: a single Lua script does INCR + PEXPIRE (first hit) + PTTL, so concurrent requests can never
 * both pass a check-then-write race (unlike the older zcard-then-zadd sliding window). If Redis is unavailable
 * or slow, we fall back to a per-process in-memory window so limits still apply (fail-closed-ish, per instance).
 */

export interface FixedWindowRateLimitInput {
  /** Fully-qualified key, e.g. `fsm:global:rate:ip:1.2.3.4`. */
  key: string;
  limit: number;
  windowMs: number;
}

export interface FixedWindowRateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  /** Seconds until the window resets (>= 1). */
  retryAfterSeconds: number;
  store: "redis" | "memory";
}

/** Minimal surface of ioredis we use; lets tests inject a fake or a failing client. */
export interface RateLimitRedisClient {
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

export const FIXED_WINDOW_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { count, ttl }
`;

const REDIS_TIMEOUT_MS = 250;
const MEMORY_MAX_KEYS = 50_000;

const memoryWindows = new Map<string, { count: number; resetAt: number }>();
let redisOverride: RateLimitRedisClient | null | undefined;

function hitMemory(input: FixedWindowRateLimitInput, now: number): FixedWindowRateLimitResult {
  let entry = memoryWindows.get(input.key);
  if (!entry || entry.resetAt <= now) {
    if (memoryWindows.size >= MEMORY_MAX_KEYS) {
      for (const [k, v] of memoryWindows) {
        if (v.resetAt <= now) memoryWindows.delete(k);
      }
      if (memoryWindows.size >= MEMORY_MAX_KEYS) memoryWindows.clear();
    }
    entry = { count: 0, resetAt: now + input.windowMs };
    memoryWindows.set(input.key, entry);
  }
  entry.count += 1;
  return {
    allowed: entry.count <= input.limit,
    count: entry.count,
    limit: input.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    store: "memory"
  };
}

async function resolveRedis(): Promise<RateLimitRedisClient | null> {
  if (redisOverride !== undefined) return redisOverride;
  if (env.NODE_ENV === "test") return null;
  const { redisConnection } = await import("@fsm/jobs");
  return redisConnection as unknown as RateLimitRedisClient;
}

async function hitRedis(client: RateLimitRedisClient, input: FixedWindowRateLimitInput): Promise<FixedWindowRateLimitResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("rate-limit redis timeout")), REDIS_TIMEOUT_MS);
  });
  try {
    const raw = await Promise.race([client.eval(FIXED_WINDOW_LUA, 1, input.key, input.windowMs), timeout]);
    if (!Array.isArray(raw) || raw.length < 2) throw new Error("unexpected rate-limit redis reply");
    const count = Number(raw[0]);
    const ttlMs = Number(raw[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) throw new Error("unexpected rate-limit redis reply");
    return {
      allowed: count <= input.limit,
      count,
      limit: input.limit,
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
      store: "redis"
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function hitFixedWindowRateLimit(input: FixedWindowRateLimitInput): Promise<FixedWindowRateLimitResult> {
  const now = Date.now();
  const client = await resolveRedis().catch(() => null);
  if (client) {
    try {
      return await hitRedis(client, input);
    } catch {
      // Redis down/slow — fall through to the in-memory window.
    }
  }
  return hitMemory(input, now);
}

export function normalizeRateLimitIp(ip: string | undefined): string {
  const trimmed = (ip ?? "").trim();
  return trimmed.length > 0 ? trimmed : "unknown";
}

/** Test hook: `null` forces memory, a client forces Redis path, `undefined` restores default resolution. */
export function setRateLimitRedisClientForTests(client: RateLimitRedisClient | null | undefined): void {
  redisOverride = client;
}

export function resetFixedWindowRateLimitStateForTests(): void {
  memoryWindows.clear();
  redisOverride = undefined;
}
