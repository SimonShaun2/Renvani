import { describe, expect, it } from "vitest";

import { FS_MIGRATE_RLS_POLICY_CATALOG } from "./rls-policy-catalog.js";
import { TENANT_SESSION_GUC } from "./tenant-session.js";

describe("FS_MIGRATE_RLS_POLICY_CATALOG", () => {
  it("references the tenant session GUC in every policy", () => {
    expect(FS_MIGRATE_RLS_POLICY_CATALOG.length).toBeGreaterThan(0);
    for (const policy of FS_MIGRATE_RLS_POLICY_CATALOG) {
      expect(policy.usingExpression).toContain(TENANT_SESSION_GUC);
      expect(policy.policyName).toMatch(/^tenant_isolation_/);
    }
  });
});
