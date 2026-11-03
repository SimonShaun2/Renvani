import { sql } from "drizzle-orm";

import { TENANT_SESSION_GUC } from "./tenant-session.js";
import {
  runTransactionWithRetry,
  type RunTransactionWithRetryOptions,
  type TransactionCallback
} from "./transactions.js";

function parseCompanyIdForSession(companyId: string): string {
  const trimmed = companyId.trim();
  const COMPANY_ID_UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!COMPANY_ID_UUID_RE.test(trimmed)) {
    throw new Error("Invalid company id");
  }
  return trimmed.toLowerCase();
}

/**
 * Runs a transaction with `SET LOCAL app.current_company_id` for RLS (STACK-02 + STACK-10).
 */
export async function runTransactionWithTenantSession<T>(
  companyId: string,
  callback: TransactionCallback<T>,
  options?: RunTransactionWithRetryOptions
): Promise<T> {
  const tenantId = parseCompanyIdForSession(companyId);
  return runTransactionWithRetry(async (tx) => {
    await tx.execute(
      sql`select set_config(${TENANT_SESSION_GUC}, ${tenantId}, true)`
    );
    return callback(tx);
  }, options);
}
