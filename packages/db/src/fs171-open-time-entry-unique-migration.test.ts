import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0046_fs171_open_time_entry_unique";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const sql0045 = readFileSync(join(packageRoot, "migrations", "0045_fs171_timesheets_payroll.sql"), "utf8");

describe("FS-171 open time entry unique index migration (0046)", () => {
  it("is journaled at idx 46 after 0045 with a strictly later when, and the bundle is gap-free", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    const prev = journal.entries.find((e) => e.tag === "0045_fs171_timesheets_payroll");
    expect(entry?.idx).toBe(46);
    expect(prev?.idx).toBe(45);
    expect(entry!.when).toBe(1792716506141);
    expect(entry!.when).toBeGreaterThan(prev!.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("dedupes open entries before creating the partial unique index idempotently", () => {
    const dedupeAt = sqlText.indexOf('UPDATE "time_entries"');
    const indexAt = sqlText.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_open_technician_idx"');
    expect(dedupeAt).toBeGreaterThan(-1);
    expect(indexAt).toBeGreaterThan(dedupeAt);
    expect(sqlText).toContain('WHERE "ended_at" IS NULL AND "deleted_at" IS NULL');
    expect(sqlText).toContain('PARTITION BY "company_id", "technician_id"');
    expect(sqlText).toContain('GREATEST(r."next_started_at", te."started_at")');
    expect(sqlText).not.toMatch(/^\s*(DROP|DELETE|TRUNCATE)\b/im);
  });

  it("0045 stays the CI-applied content (no open-entry index there)", () => {
    expect(sql0045).not.toContain("time_entries_open_technician_idx");
  });
});
