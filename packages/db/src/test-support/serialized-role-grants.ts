import { sql } from "drizzle-orm";

/**
 * Fixed advisory-lock key for test role/GRANT setup. Parallel vitest files each CREATE ROLE and GRANT on the shared
 * `public` schema; concurrent GRANTs update the same pg_namespace/pg_authid catalog rows and fail with
 * "tuple concurrently updated" (XX000). Taking one transaction-scoped advisory lock serializes that setup across files.
 */
export const TEST_ROLE_GRANT_LOCK_KEY = 4_452_001;

interface TransactionalDb {
  transaction<T>(run: (tx: { execute(query: ReturnType<typeof sql.raw>): Promise<unknown> }) => Promise<T>): Promise<T>;
}

/** Run role-creation / GRANT statements in one transaction under the shared advisory lock. Test-only. */
export async function runSerializedRoleGrants(db: unknown, statements: readonly string[]): Promise<void> {
  await (db as TransactionalDb).transaction(async (tx) => {
    await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(${TEST_ROLE_GRANT_LOCK_KEY})`));
    for (const statement of statements) {
      await tx.execute(sql.raw(statement));
    }
  });
}
