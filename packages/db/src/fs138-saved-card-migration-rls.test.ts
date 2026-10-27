import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0042_fs138_saved_card_migration";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");

describe("FS-138 saved card migration table", () => {
  it("enables and forces RLS with the standard tenant_isolation policy (0027+ pattern)", () => {
    expect(sqlText).toContain('ALTER TABLE "saved_card_migrations" ENABLE ROW LEVEL SECURITY;');
    expect(sqlText).toContain('ALTER TABLE "saved_card_migrations" FORCE ROW LEVEL SECURITY;');
    expect(sqlText).toContain(
      `CREATE POLICY "tenant_isolation_saved_card_migrations" ON "saved_card_migrations" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));`
    );
  });

  it("records owner off-session consent acknowledgment columns and passes migration safety", () => {
    expect(sqlText).toContain('"off_session_consent_acknowledged_at" timestamp');
    expect(sqlText).toContain('"off_session_consent_acknowledged_by_id" uuid');
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });
});
