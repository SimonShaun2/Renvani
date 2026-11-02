import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const packageRoot = join(import.meta.dirname, "..");
// Journal idx 55 (54 = #271 growth lead attribution, pending at authoring time; merge after it).
const TAG = "0055_growth_marketing_intake";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const schemaText = readFileSync(join(packageRoot, "src", "schema.ts"), "utf8");

describe("Growth marketing intake migration (platform tables)", () => {
  it("is journaled at idx 55 with `when` later than every prior entry", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry?.idx).toBe(55);
    for (const prior of journal.entries.filter((e) => e.idx < 55)) expect(entry!.when).toBeGreaterThan(prior.when);
  });

  it("is additive and re-runnable (no enums, no destructive DDL)", () => {
    expect(sqlText).not.toMatch(/CREATE TYPE|DROP |ALTER TABLE|TRUNCATE|DELETE /i);
    expect(sqlText).toContain('CREATE TABLE IF NOT EXISTS "marketing_demo_requests"');
    expect(sqlText).toContain('CREATE TABLE IF NOT EXISTS "marketing_growth_checks"');
    for (const stmt of sqlText.split("--> statement-breakpoint")) {
      if (/CREATE (UNIQUE )?INDEX/.test(stmt)) expect(stmt).toMatch(/IF NOT EXISTS/);
    }
  });

  it.each(["marketing_demo_requests", "marketing_growth_checks"])("%s is platform-level: no company_id, no tenant policy, no raw IP", (table) => {
    const create = sqlText.split("--> statement-breakpoint").find((s) => s.includes(`CREATE TABLE IF NOT EXISTS "${table}"`))!;
    expect(create).not.toContain("company_id");
    expect(create).not.toMatch(/"ip"|ip_address/);
    expect(create).toContain('"status" varchar(32) DEFAULT \'new\' NOT NULL');
    expect(sqlText).not.toContain(`tenant_isolation_${table}`);
    expect(schemaText).toContain(`pgTable("${table}"`);
  });
});
