import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0054_growth_lead_attribution";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const schemaText = readFileSync(join(packageRoot, "src", "schema.ts"), "utf8");

describe("Growth lead attribution migration", () => {
  it("is journaled at idx 54 after 53 and passes the repo migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    const prior = journal.entries.find((e) => e.idx === 53);
    expect(entry?.idx).toBe(54);
    expect(entry!.when).toBeGreaterThan(prior!.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("is additive, guarded and re-runnable (nullable jsonb, no enum, no index, no policy)", () => {
    expect(sqlText).toContain('ALTER TABLE "booking_requests" ADD COLUMN IF NOT EXISTS "lead_attribution" jsonb;');
    expect(sqlText).toContain('ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "lead_attribution" jsonb;');
    expect(sqlText).not.toMatch(/CREATE TYPE|DROP |NOT NULL|DEFAULT|UPDATE |CREATE (UNIQUE )?INDEX|POLICY/i);
  });

  it("schema.ts maps both columns", () => {
    expect(schemaText.match(/leadAttribution: jsonb\("lead_attribution"\)/g)?.length).toBe(2);
  });
});
