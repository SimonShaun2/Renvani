import { apiEnv as env } from "@fsm/config/runtime-env";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_SECONDS = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);

export const GROWTH_CHECK_GLOBAL_ENQUEUE_LIMIT = 30;
export const GROWTH_CHECK_TENANT_ENQUEUE_LIMIT = 5;

const globalEnqueueTimes: number[] = [];
const tenantEnqueueTimes = new Map<string, number[]>();

function useInMemoryStore(): boolean {
  return env.NODE_ENV === "test";
}

function recordInMemory(mapOrGlobal: Map<string, number[]> | null, key: string | null, limit: number): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  if (mapOrGlobal && key) {
    const active = (mapOrGlobal.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (active.length >= limit) {
      return false;
    }
    active.push(now);
    mapOrGlobal.set(key, active);
    return true;
  }

  const activeGlobal = globalEnqueueTimes.filter((timestamp) => timestamp > cutoff);
  if (activeGlobal.length >= limit) {
    return false;
  }
  activeGlobal.push(now);
  globalEnqueueTimes.length = 0;
  globalEnqueueTimes.push(...activeGlobal);
  return true;
}

async function recordRedis(key: string, limit: number): Promise<boolean> {
  const { redisConnection } = await import("@fsm/jobs");
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  await redisConnection.zremrangebyscore(key, 0, cutoff);
  const count = await redisConnection.zcard(key);
  if (count >= limit) {
    return false;
  }

  await redisConnection.zadd(key, now, member);
  await redisConnection.expire(key, RATE_LIMIT_WINDOW_SECONDS + 60);
  return true;
}

async function recordAttempt(
  redisKey: string,
  memoryMap: Map<string, number[]> | null,
  memoryKey: string | null,
  limit: number
): Promise<boolean> {
  if (useInMemoryStore()) {
    return recordInMemory(memoryMap, memoryKey, limit);
  }

  try {
    return await recordRedis(redisKey, limit);
  } catch {
    return recordInMemory(memoryMap, memoryKey, limit);
  }
}

export async function checkGrowthCheckEnqueueRateLimits(companyId: string): Promise<{
  allowed: boolean;
  scope: "global" | "tenant" | null;
}> {
  const globalAllowed = await recordAttempt(
    "fsm:growth-check:enqueue:global",
    null,
    null,
    GROWTH_CHECK_GLOBAL_ENQUEUE_LIMIT
  );

  if (!globalAllowed) {
    return { allowed: false, scope: "global" };
  }

  const tenantAllowed = await recordAttempt(
    `fsm:growth-check:enqueue:tenant:${companyId}`,
    tenantEnqueueTimes,
    companyId,
    GROWTH_CHECK_TENANT_ENQUEUE_LIMIT
  );

  if (!tenantAllowed) {
    return { allowed: false, scope: "tenant" };
  }

  return { allowed: true, scope: null };
}

export function resetGrowthCheckEnqueueRateLimitsForTests(): void {
  globalEnqueueTimes.length = 0;
  tenantEnqueueTimes.clear();
}
