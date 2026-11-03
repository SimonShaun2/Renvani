import { env } from "@fsm/config";
import { AppError, ErrorCode } from "@fsm/types";

const MANAGE_STORE_UNAVAILABLE = "Manage link service is temporarily unavailable. Please try again.";

const consumedManageJtis = new Set<string>();
const holdLockManageJtis = new Set<string>();

function consumedRedisKey(jti: string): string {
  return `fsm:public-booking:manage-consumed:${jti}`;
}

function holdLockRedisKey(jti: string): string {
  return `fsm:public-booking:manage-hold:${jti}`;
}

function useInMemoryStore(): boolean {
  return env.NODE_ENV === "test";
}

export async function isBookingManageTokenConsumed(jti: string): Promise<boolean> {
  if (useInMemoryStore()) {
    return consumedManageJtis.has(jti);
  }

  try {
    const { redisConnection } = await import("@fsm/jobs");
    const value = await redisConnection.get(consumedRedisKey(jti));
    return value === "1";
  } catch {
    // Fail closed: never fall back to per-process memory for used-link records.
    throw new AppError(ErrorCode.INTERNAL_ERROR, MANAGE_STORE_UNAVAILABLE);
  }
}

export async function markBookingManageTokenConsumed(jti: string, ttlSeconds: number): Promise<void> {
  if (useInMemoryStore()) {
    consumedManageJtis.add(jti);
    holdLockManageJtis.delete(jti);
    return;
  }

  try {
    const { redisConnection } = await import("@fsm/jobs");
    await redisConnection.set(consumedRedisKey(jti), "1", "EX", ttlSeconds);
    await redisConnection.del(holdLockRedisKey(jti));
  } catch {
    throw new AppError(ErrorCode.INTERNAL_ERROR, MANAGE_STORE_UNAVAILABLE);
  }
}

/**
 * Atomically claims single use of a manage link (SET NX on the consumed key).
 * Returns false when the link was already used. Throws (fail closed) if Redis is unavailable.
 */
export async function claimBookingManageTokenUse(jti: string, ttlSeconds: number): Promise<boolean> {
  if (useInMemoryStore()) {
    if (consumedManageJtis.has(jti)) {
      return false;
    }

    consumedManageJtis.add(jti);
    return true;
  }

  try {
    const { redisConnection } = await import("@fsm/jobs");
    const result = await redisConnection.set(consumedRedisKey(jti), "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch {
    throw new AppError(ErrorCode.INTERNAL_ERROR, MANAGE_STORE_UNAVAILABLE);
  }
}

/** Releases a claim when the guarded action failed, so the customer can retry. */
export async function releaseBookingManageTokenUse(jti: string): Promise<void> {
  if (useInMemoryStore()) {
    consumedManageJtis.delete(jti);
    return;
  }

  try {
    const { redisConnection } = await import("@fsm/jobs");
    await redisConnection.del(consumedRedisKey(jti));
  } catch {
    // Leaving the link consumed is the fail-closed outcome.
  }
}

export async function claimBookingManageTokenHoldLock(jti: string, ttlSeconds: number): Promise<boolean> {
  if (await isBookingManageTokenConsumed(jti)) {
    return false;
  }

  if (useInMemoryStore()) {
    if (holdLockManageJtis.has(jti)) {
      return false;
    }

    holdLockManageJtis.add(jti);
    return true;
  }

  try {
    const { redisConnection } = await import("@fsm/jobs");
    const result = await redisConnection.set(holdLockRedisKey(jti), "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch {
    return false;
  }
}

export async function releaseBookingManageTokenHoldLock(jti: string): Promise<void> {
  if (useInMemoryStore()) {
    holdLockManageJtis.delete(jti);
    return;
  }

  try {
    const { redisConnection } = await import("@fsm/jobs");
    await redisConnection.del(holdLockRedisKey(jti));
  } catch {
    // Lock expires via TTL.
  }
}

export function resetBookingManageTokenStoreForTests(): void {
  consumedManageJtis.clear();
  holdLockManageJtis.clear();
}
