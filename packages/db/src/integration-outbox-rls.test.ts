import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TENANT_SESSION_GUC } from "./tenant-session.js";

const MIGRATION_TAG = "0050_fs15_integration_outbox_audit";

describe("FS-15 integration outbox RLS (migration 0050)", () => {
  it("enables tenant isolation policies on outbox tables", () => {
    const migrationPath = join(import.meta.dirname, "..", "migrations", `${MIGRATION_TAG}.sql`);
    const sql = readFileSync(migrationPath, "utf8");

    for (const table of ["integration_outbox_operations", "integration_outbox_audit_events"]) {
      expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      expect(sql).toContain(TENANT_SESSION_GUC);
    }
  });
});
