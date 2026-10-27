import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../migrations");

describe("service agreements import tenant + idempotency guards", () => {
  it("scopes maintenance plan lineage uniqueness per company", () => {
    const sql = readFileSync(join(migrationsDir, "0040_fs_migrate_service_agreements_import.sql"), "utf8");

    expect(sql).toContain("maintenance_plans_import_lineage_idx");
    expect(sql).toContain("company_id");
    expect(sql).toContain("source_system");
    expect(sql).toContain("source_id");
  });

  it("registers service_agreements as a dedicated import entity type", () => {
    const sql = readFileSync(join(migrationsDir, "0040_fs_migrate_service_agreements_import.sql"), "utf8");
    expect(sql).toContain("'service_agreements'");
  });
});
