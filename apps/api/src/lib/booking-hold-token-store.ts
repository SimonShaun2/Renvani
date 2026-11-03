import { apiEnv as env } from "@fsm/config/runtime-env";

const consumedHoldJtis = new Set<string>();

function holdJtiRedisKey(jti: string): string {
  return `fsm:public-booking:hold-jti:${jti}`;
}

function useInMemoryHoldJtiStore(): boolean {
  return env.NODE_ENV === "test";
}

export async function claimBookingHoldTokenJti(jti: string, ttlSeconds: number): Promise<boolean> {
  if (useInMemoryHoldJtiStore()) {
    if (consumedHoldJtis.has(jti)) {
      return false;
    }

    consumedHoldJtis.add(jti);
    return true;
  }

  try {
    const { redisConnection } = await import("@fsm/jobs");
    const result = await redisConnection.set(holdJtiRedisKey(jti), "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch {
    if (consumedHoldJtis.has(jti)) {
      return false;
    }

    consumedHoldJtis.add(jti);
    return true;
  }
}

export async function releaseBookingHoldTokenJti(jti: string): Promise<void> {
  if (useInMemoryHoldJtiStore()) {
    consumedHoldJtis.delete(jti);
    return;
  }

  try {
    const { redisConnection } = await import("@fsm/jobs");
    await redisConnection.del(holdJtiRedisKey(jti));
  } catch {
    consumedHoldJtis.delete(jti);
  }
}

export function resetBookingHoldTokenJtiStateForTests(): void {
  consumedHoldJtis.clear();
}
