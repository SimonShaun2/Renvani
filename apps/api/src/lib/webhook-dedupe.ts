import { randomUUID } from "node:crypto";

import { env } from "@fsm/config";

/**
 * FS-158 — two-phase webhook dedupe (claim → complete | release).
 *
 * - claim: atomically SET key = "processing:<token>" NX with a SHORT lease (PROCESSING_TTL_SECONDS). If the
 *   process crashes mid-handler, the lease simply expires and the sender's retry is processed (previously the
 *   id stayed claimed for 24h and retries were dropped).
 * - complete: only after the handler succeeds, the holder swaps the value to "done" for DONE_TTL_SECONDS (24h),
 *   so later redeliveries are acknowledged as duplicates.
 * - release: on failure the holder deletes its own claim (token-checked) so the sender can retry immediately.
 * - A delivery that arrives while another is still processing gets "in_progress" (callers answer non-2xx so the
 *   sender retries later) — never silently acked.
 *
 * Redis is the cross-instance store. If Redis is unavailable/slow we fall back to a per-process in-memory store
 * with the same semantics; this is NOT cross-instance, so handlers must stay idempotent on their own (Clerk
 * provisioning is: per-org advisory lock + find-or-create + unique indexes).
 */

export const PROCESSING_TTL_SECONDS = 5 * 60;
export const DONE_TTL_SECONDS = 24 * 60 * 60;
const REDIS_TIMEOUT_MS = 250;
const MEMORY_MAX_KEYS = 10_000;

export type WebhookClaimStatus = "claimed" | "duplicate" | "in_progress";

export interface WebhookClaim {
  status: WebhookClaimStatus;
  /** Present when status === "claimed"; pass to complete/release. */
  token?: string;
  store: "redis" | "memory";
}

/** Minimal ioredis surface; tests inject a fake or failing client. */
export interface WebhookDedupeRedisClient {
  set(key: string, value: string, ex: "EX", seconds: number, nx: "NX"): Promise<unknown>;
  get(key: string): Promise<string | null>;
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

// Swap our own processing lease to "done" (only if we still hold it).
const COMPLETE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('SET', KEYS[1], 'done', 'EX', ARGV[2])
  return 1
end
return 0
`;

// Delete our own processing lease (never someone else's, never a "done" marker).
const RELEASE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

const memory = new Map<string, { value: string; expiresAt: number }>();
let redisOverride: WebhookDedupeRedisClient | null | undefined;
let nowOverride: (() => number) | undefined;

const now = () => (nowOverride ? nowOverride() : Date.now());
const dedupeKey = (source: string, messageId: string) => `fsm:webhook-dedupe:${source}:${messageId}`;

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  memory.delete(key);
  if (memory.size >= MEMORY_MAX_KEYS) {
    const t = now();
    for (const [k, v] of memory) if (v.expiresAt <= t) memory.delete(k);
    // Evict oldest only as needed (never clear everything).
    for (const k of memory.keys()) {
      if (memory.size < MEMORY_MAX_KEYS) break;
      memory.delete(k);
    }
  }
  memory.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
}

function statusFromExisting(value: string | null): WebhookClaimStatus {
  return value === "done" ? "duplicate" : "in_progress";
}

async function resolveRedis(): Promise<WebhookDedupeRedisClient | null> {
  if (redisOverride !== undefined) return redisOverride;
  if (env.NODE_ENV === "test") return null;
  const { redisConnection } = await import("@fsm/jobs");
  return redisConnection as unknown as WebhookDedupeRedisClient;
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("webhook-dedupe redis timeout")), REDIS_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Atomically claim a webhook message id for processing. */
export async function claimWebhookMessage(source: string, messageId: string): Promise<WebhookClaim> {
  const key = dedupeKey(source, messageId);
  const token = `processing:${randomUUID()}`;
  const client = await resolveRedis().catch(() => null);
  if (client) {
    try {
      const result = await withTimeout(client.set(key, token, "EX", PROCESSING_TTL_SECONDS, "NX"));
      if (result === "OK") return { status: "claimed", token, store: "redis" };
      const existing = await withTimeout(client.get(key));
      if (existing === null) {
        // Expired between SET and GET: try once more.
        const retry = await withTimeout(client.set(key, token, "EX", PROCESSING_TTL_SECONDS, "NX"));
        if (retry === "OK") return { status: "claimed", token, store: "redis" };
        return { status: "in_progress", store: "redis" };
      }
      return { status: statusFromExisting(existing), store: "redis" };
    } catch {
      // Redis down/slow — per-instance fallback below.
    }
  }
  const existing = memoryGet(key);
  if (existing !== null) return { status: statusFromExisting(existing), store: "memory" };
  memorySet(key, token, PROCESSING_TTL_SECONDS);
  return { status: "claimed", token, store: "memory" };
}

/** Mark a successfully processed message as done (24h) so redeliveries are acked as duplicates. */
export async function completeWebhookMessage(source: string, messageId: string, token: string): Promise<void> {
  const key = dedupeKey(source, messageId);
  if (memoryGet(key) === token) memorySet(key, "done", DONE_TTL_SECONDS);
  const client = await resolveRedis().catch(() => null);
  if (!client) return;
  try {
    await withTimeout(client.eval(COMPLETE_LUA, 1, key, token, DONE_TTL_SECONDS));
  } catch {
    // best effort: the processing lease expires and a retry re-runs an idempotent handler
  }
}

/** Release a failed delivery's claim so the sender's retry is processed. */
export async function releaseWebhookMessage(source: string, messageId: string, token: string): Promise<void> {
  const key = dedupeKey(source, messageId);
  if (memoryGet(key) === token) memory.delete(key);
  const client = await resolveRedis().catch(() => null);
  if (!client) return;
  try {
    await withTimeout(client.eval(RELEASE_LUA, 1, key, token));
  } catch {
    // best effort: the short processing lease expires on its own
  }
}

/** Test hook: `null` forces memory, a client forces Redis, `undefined` restores default resolution. */
export function setWebhookDedupeRedisClientForTests(client: WebhookDedupeRedisClient | null | undefined): void {
  redisOverride = client;
}

export function setWebhookDedupeNowForTests(fn: (() => number) | undefined): void {
  nowOverride = fn;
}

export function resetWebhookDedupeForTests(): void {
  memory.clear();
  redisOverride = undefined;
  nowOverride = undefined;
}
