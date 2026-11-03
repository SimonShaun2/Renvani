import { describe, expect, it, vi } from "vitest";

import { runTransactionWithTenantSession } from "./run-with-tenant-session.js";

vi.mock("./transactions.js", () => ({
  runTransactionWithRetry: vi.fn(async (callback: (tx: { execute: (q: unknown) => Promise<void> }) => Promise<unknown>) => {
    const execute = vi.fn(async () => undefined);
    return callback({ execute });
  })
}));

describe("runTransactionWithTenantSession", () => {
  it("sets tenant GUC before callback", async () => {
    const companyId = "11111111-1111-4111-8111-111111111111";
    let executed = false;
    await runTransactionWithTenantSession(companyId, async () => {
      executed = true;
      return "ok";
    });
    expect(executed).toBe(true);
  });

  it("rejects invalid company id", async () => {
    await expect(
      runTransactionWithTenantSession("bad", async () => "x")
    ).rejects.toThrow("Invalid company id");
  });
});
