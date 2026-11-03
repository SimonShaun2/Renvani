import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";
import { callTrackingNumbers } from "./schema.js";

const packageRoot = join(import.meta.dirname, "..");
// Journal idx 60: idx 59 is FS-212 (#362, estimate option sets).
const TAG = "0060_call_tracking_numbers_verified_at";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");

describe("FS-200 call_tracking_numbers.verified_at migration", () => {
  it("is journaled at idx 60, contiguous, with `when` later than every prior entry, and passes the safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry?.idx).toBe(60);
    expect(journal.entries.map((e) => e.idx)).toEqual(journal.entries.map((_, i) => i));
    for (const prior of journal.entries.filter((e) => e.idx < 60)) expect(entry!.when).toBeGreaterThan(prior.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("is a single additive, nullable, idempotent column add with RLS untouched", () => {
    const statements = sqlText.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    expect(statements).toEqual([`ALTER TABLE "call_tracking_numbers" ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;`]);
    expect(sqlText).not.toMatch(/NOT NULL|DEFAULT|DROP|POLICY|ROW LEVEL SECURITY|UPDATE|DELETE/i);
  });

  it("matches schema.ts: nullable timestamptz verified_at", () => {
    const column = getTableConfig(callTrackingNumbers).columns.find((c) => c.name === "verified_at");
    expect(column).toBeDefined();
    expect(column!.notNull).toBe(false);
    expect(column!.getSQLType()).toBe("timestamp with time zone");
  });
});
