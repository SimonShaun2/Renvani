import { beforeEach, describe, expect, it, vi } from "vitest";

import { featureFlags } from "@fsm/config/feature-flags";

import {
  isTenantSessionScopedWritesEnabled,
  runCompanyScopedTransaction,
  runTenantAwareTransaction
} from "./company-scoped-transaction.js";

const runTransactionWithRetry = vi.fn(async (callback: (tx: { marker: string }) => Promise<string>) =>
  callback({ marker: "plain" })
);
const runTransactionWithTenantSession = vi.fn(
  async (_companyId: string, callback: (tx: { marker: string }) => Promise<string>) =>
    callback({ marker: "tenant" })
);

vi.mock("@fsm/db", () => ({
  runTransactionWithRetry: (callback: (tx: { marker: string }) => Promise<string>) =>
    runTransactionWithRetry(callback),
  runTransactionWithTenantSession: (
    companyId: string,
    callback: (tx: { marker: string }) => Promise<string>
  ) => runTransactionWithTenantSession(companyId, callback)
}));

describe("company-scoped-transaction", () => {
  const companyId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    runTransactionWithRetry.mockClear();
    runTransactionWithTenantSession.mockClear();
  });

  it("runCompanyScopedTransaction delegates to tenant session helper", async () => {
    const result = await runCompanyScopedTransaction(companyId, async (tx) =>
      (tx as unknown as { marker: string }).marker
    );
    expect(result).toBe("tenant");
    expect(runTransactionWithTenantSession).toHaveBeenCalledWith(companyId, expect.any(Function));
  });

  it("runTenantAwareTransaction uses plain transaction when flag is off", async () => {
    expect(isTenantSessionScopedWritesEnabled()).toBe(featureFlags.tenantSessionScopedWrites);
    const result = await runTenantAwareTransaction(companyId, async (tx) =>
      (tx as unknown as { marker: string }).marker
    );
    expect(result).toBe("plain");
    expect(runTransactionWithRetry).toHaveBeenCalled();
    expect(runTransactionWithTenantSession).not.toHaveBeenCalled();
  });
});
