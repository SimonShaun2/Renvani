import { runTransactionWithRetry, runTransactionWithTenantSession, type TransactionCallback } from "@fsm/db";
import { featureFlags } from "@fsm/config/feature-flags";

/**
 * STACK-02 — run business logic in a transaction with tenant session GUC set for RLS.
 */
export async function runCompanyScopedTransaction<T>(
  companyId: string,
  callback: TransactionCallback<T>
): Promise<T> {
  return runTransactionWithTenantSession(companyId, callback);
}

export function isTenantSessionScopedWritesEnabled(): boolean {
  // FEATURE FLAG: tenant-session-scoped-writes
  return featureFlags.tenantSessionScopedWrites;
}

/**
 * Uses tenant session GUC when `tenantSessionScopedWrites` is enabled; otherwise plain retrying transaction.
 */
export async function runTenantAwareTransaction<T>(
  companyId: string,
  callback: TransactionCallback<T>
): Promise<T> {
  if (isTenantSessionScopedWritesEnabled()) {
    return runCompanyScopedTransaction(companyId, callback);
  }

  return runTransactionWithRetry(callback);
}
