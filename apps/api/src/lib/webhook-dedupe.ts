import { env } from "@fsm/config";

const DEDUPE_TTL_SECONDS = 24 * 60 * 60;
const seen = new Map<string, number>();

function claimInMemory(key: string, now: number): boolean {
  for (const [k, expiresAt] of seen) {
    if (expiresAt <= now) seen.delete(k);
  }
  if (seen.has(key)) {
    return false;
  }
  seen.set(key, now + DEDUPE_TTL_SECONDS * 1000);
  return true;
}

/** Returns true the first time a webhook message id is seen (Redis SET NX, in-memory fallback). */
export async function claimWebhookMessageId(source: string, messageId: string): Promise<boolean> {
  const key = `fsm:webhook-dedupe:${source}:${messageId}`;
  const now = Date.now();
  if (env.NODE_ENV === "test") {
    return claimInMemory(key, now);
  }
  try {
    const { redisConnection } = await import("@fsm/jobs");
    const result = await redisConnection.set(key, "1", "EX", DEDUPE_TTL_SECONDS, "NX");
    return result === "OK";
  } catch {
    return claimInMemory(key, now);
  }
}

/** Lets a failed delivery be retried by the sender. */
export async function releaseWebhookMessageId(source: string, messageId: string): Promise<void> {
  const key = `fsm:webhook-dedupe:${source}:${messageId}`;
  seen.delete(key);
  if (env.NODE_ENV === "test") return;
  try {
    const { redisConnection } = await import("@fsm/jobs");
    await redisConnection.del(key);
  } catch {
    // best effort
  }
}

export function resetWebhookDedupeForTests(): void {
  seen.clear();
}
