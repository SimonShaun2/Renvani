import { isIP } from "node:net";

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
const DEFAULT_MEMORY_MAX_KEYS = 50_000;
let memoryMaxKeys = DEFAULT_MEMORY_MAX_KEYS;

const memoryWindows = new Map<string, { count: number; resetAt: number }>();
let redisOverride: RateLimitRedisClient | null | undefined;

/**
 * Make room for one new key without wiping active limits: drop expired windows first, then only as many
 * of the oldest (earliest-started) windows as needed. Never clear() — that would let an attacker flood
 * distinct keys to reset everyone's limits.
 */
function evictMemoryWindows(now: number): void {
  for (const [k, v] of memoryWindows) {
    if (v.resetAt <= now) memoryWindows.delete(k);
  }
  if (memoryWindows.size < memoryMaxKeys) return;
  let excess = memoryWindows.size - memoryMaxKeys + 1;
  for (const k of memoryWindows.keys()) {
    if (excess <= 0) break;
    memoryWindows.delete(k);
    excess -= 1;
  }
}

function hitMemory(input: FixedWindowRateLimitInput, now: number): FixedWindowRateLimitResult {
  let entry = memoryWindows.get(input.key);
  if (!entry || entry.resetAt <= now) {
    if (entry) memoryWindows.delete(input.key);
    else if (memoryWindows.size >= memoryMaxKeys) evictMemoryWindows(now);
    entry = { count: 0, resetAt: now + input.windowMs };
    // Re-insert so Map iteration order == window start order (oldest first).
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

const INVALID_IP_BUCKET = "invalid";

function parseIpv6Groups(addr: string): number[] | null {
  let text = addr;
  // Rewrite an embedded IPv4 tail (e.g. ::ffff:1.2.3.4) as two hex groups.
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    if (isIP(tail) !== 4) return null;
    const o = tail.split(".").map(Number) as [number, number, number, number];
    text = `${text.slice(0, lastColon + 1)}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
  }
  const parse = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const h of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(h)) return null;
      out.push(parseInt(h, 16));
    }
    return out;
  };
  const dbl = text.indexOf("::");
  if (dbl >= 0) {
    const head = parse(text.slice(0, dbl));
    const rest = parse(text.slice(dbl + 2));
    if (!head || !rest || head.length + rest.length > 7) return null;
    return [...head, ...new Array<number>(8 - head.length - rest.length).fill(0), ...rest];
  }
  const all = parse(text);
  return all && all.length === 8 ? all : null;
}

function compressIpv6(groups: number[]): string {
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) { i += 1; continue; }
    let j = i;
    while (j < 8 && groups[j] === 0) j += 1;
    if (j - i > bestLen && j - i >= 2) { bestStart = i; bestLen = j - i; }
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (bestStart < 0) return hex.join(":");
  return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLen).join(":")}`;
}

/**
 * Canonical rate-limit bucket for a client IP:
 * - IPv4: kept as-is (dotted quad).
 * - IPv4-mapped IPv6 (::ffff:a.b.c.d or ::ffff:XXXX:XXXX): unmapped to dotted IPv4, so both forms share a bucket.
 * - IPv6: brackets/zone id stripped, lowercased, lower 64 bits zeroed (bucket per /64), RFC 5952 compressed.
 * - Empty: "unknown"; anything unparseable: a single "invalid" fallback bucket.
 */
export function normalizeRateLimitIp(ip: string | undefined): string {
  let text = (ip ?? "").trim().toLowerCase();
  if (text.length === 0) return "unknown";
  if (text.length > 100) return INVALID_IP_BUCKET;
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(text);
  if (bracketed) text = bracketed[1]!;
  const zone = text.indexOf("%");
  if (zone >= 0) text = text.slice(0, zone);
  const v = isIP(text);
  if (v === 4) return text;
  if (v !== 6) return INVALID_IP_BUCKET;
  const groups = parseIpv6Groups(text);
  if (!groups) return INVALID_IP_BUCKET;
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    return [groups[6]! >> 8, groups[6]! & 0xff, groups[7]! >> 8, groups[7]! & 0xff].join(".");
  }
  return `${compressIpv6([...groups.slice(0, 4), 0, 0, 0, 0])}/64`;
}

/** Test hook: `null` forces memory, a client forces Redis path, `undefined` restores default resolution. */
export function setRateLimitRedisClientForTests(client: RateLimitRedisClient | null | undefined): void {
  redisOverride = client;
}

export function resetFixedWindowRateLimitStateForTests(): void {
  memoryWindows.clear();
  redisOverride = undefined;
  memoryMaxKeys = DEFAULT_MEMORY_MAX_KEYS;
}

/** Test hook: shrink the in-memory store cap to exercise eviction. */
export function setRateLimitMemoryMaxKeysForTests(max: number): void {
  memoryMaxKeys = max;
}
