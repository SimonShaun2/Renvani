import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0059_estimate_option_sets";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");

describe("FS-212 estimate option sets migration", () => {
  it("is journaled contiguously at idx 59, later than every prior entry, and passes the safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry?.idx).toBe(59);
    journal.entries.forEach((e, index) => expect(e.idx).toBe(index));
    for (const prior of journal.entries.filter((e) => e.idx < 59)) expect(entry!.when).toBeGreaterThan(prior.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("is additive only on estimates, with defaults and a partial unique index for one recommended option per set", () => {
    expect(sqlText).not.toMatch(/^\s*(DROP|DELETE|UPDATE|TRUNCATE|INSERT)\b/im);
    expect(sqlText).not.toMatch(/ALTER TABLE "(?!estimates")[a-z_]+"/);
    expect(sqlText).toContain(`ADD COLUMN IF NOT EXISTS "is_recommended" boolean DEFAULT false NOT NULL`);
    expect(sqlText).toContain(`ADD COLUMN IF NOT EXISTS "option_set_version" integer DEFAULT 1 NOT NULL`);
    expect(sqlText).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "estimates_tier_group_recommended_idx" ON "estimates" USING btree \("company_id","tier_group_id"\) WHERE "is_recommended" = true AND "deleted_at" IS NULL AND "tier_group_id" IS NOT NULL;/
    );
  });
});
