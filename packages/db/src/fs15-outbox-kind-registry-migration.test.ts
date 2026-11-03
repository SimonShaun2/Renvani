import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0051_fs15_outbox_kind_registry";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const schemaText = readFileSync(join(packageRoot, "src", "schema.ts"), "utf8");

describe("FS-15 follow-up: outbox kind registry migration (0051)", () => {
  it("is journaled at idx 51 after 0050 and passes the repo migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    const prior = journal.entries.find((e) => e.idx === 50);
    expect(entry?.idx).toBe(51);
    expect(entry!.when).toBeGreaterThan(prior!.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("converts kind to varchar(64), drops the enum, and is re-runnable", () => {
    expect(sqlText).toContain(
      `ALTER TABLE "integration_outbox_operations" ALTER COLUMN "kind" SET DATA TYPE varchar(64) USING "kind"::text;`
    );
    expect(sqlText).toContain(`DROP TYPE IF EXISTS "public"."integration_outbox_kind";`);
    expect(sqlText).toContain("EXCEPTION WHEN duplicate_object THEN NULL; END $$;");
    expect(sqlText).toContain(
      `CREATE INDEX IF NOT EXISTS "integration_outbox_operations_status_updated_idx" ON "integration_outbox_operations" USING btree ("status","updated_at");`
    );
    // Additive: RLS on the table is untouched.
    expect(sqlText).not.toMatch(/ROW LEVEL SECURITY|POLICY/);
  });

  it("schema.ts matches: varchar kind, check, status/updated_at index, no kind enum", () => {
    expect(schemaText).toContain('kind: varchar("kind", { length: 64 }).notNull()');
    expect(schemaText).not.toContain('pgEnum("integration_outbox_kind"');
    expect(schemaText).toContain(
      'index("integration_outbox_operations_status_updated_idx").on(t.status, t.updatedAt)'
    );
    expect(schemaText).toContain(
      `check("integration_outbox_operations_kind_format_chk", sql\`"kind" ~ '^[a-z][a-z0-9_]{0,63}$'\`)`
    );
    expect(sqlText).toContain(`CHECK ("kind" ~ '^[a-z][a-z0-9_]{0,63}$')`);
  });
});
