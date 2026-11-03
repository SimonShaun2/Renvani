import { coreEnv as env } from "@fsm/config/runtime-env";

import { isRetryablePostgresError } from "./postgres-errors.js";

export interface RunWithPostgresRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function jitterMs(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs);
}

/**
 * Retries an async operation only on PostgreSQL deadlock / serialization / lock-not-available errors.
 * Use for transaction wrappers; keep callbacks free of non-idempotent external side effects.
 */
export async function runWithPostgresRetry<T>(
  operation: () => Promise<T>,
  options?: RunWithPostgresRetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? env.DATABASE_TRANSACTION_MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? env.DATABASE_TRANSACTION_RETRY_BASE_MS;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (!isRetryablePostgresError(error) || attempt >= maxRetries) {
        throw error;
      }

      const delayMs = jitterMs(baseDelayMs * 2 ** attempt);
      attempt += 1;
      await sleep(delayMs);
    }
  }
}
