import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
// Journal idx 53 (51 = #233 outbox kind registry, 52 = #234 disputes, both pending at authoring time).
const TAG = "0053_fs195_crews";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const schemaText = readFileSync(join(packageRoot, "src", "schema.ts"), "utf8");

describe("FS-195 crews migration", () => {
  it("is journaled at idx 53 after 52 and passes the repo migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    const prior = journal.entries.find((e) => e.idx === 52);
    expect(entry?.idx).toBe(53);
    expect(entry!.when).toBeGreaterThan(prior!.when);
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("is additive and re-runnable (no enums, guarded DDL)", () => {
    expect(sqlText).not.toMatch(/CREATE TYPE|DROP TABLE|DROP COLUMN/i);
    expect(sqlText).toContain('CREATE TABLE IF NOT EXISTS "crews"');
    expect(sqlText).toContain('CREATE TABLE IF NOT EXISTS "crew_members"');
    expect(sqlText).toContain('ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "crew_id" uuid;');
    for (const stmt of sqlText.split("--> statement-breakpoint")) {
      if (/ADD CONSTRAINT/.test(stmt)) expect(stmt).toMatch(/EXCEPTION WHEN duplicate_object THEN NULL/);
      if (/CREATE (UNIQUE )?INDEX/.test(stmt)) expect(stmt).toMatch(/IF NOT EXISTS/);
    }
  });

  it.each(["crews", "crew_members"])("%s has ENABLE + FORCE RLS + tenant_isolation policy", (table) => {
    expect(sqlText).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
    expect(sqlText).toContain(`DROP POLICY IF EXISTS "tenant_isolation_${table}" ON "${table}";`);
    expect(sqlText).toContain(
      `CREATE POLICY "tenant_isolation_${table}" ON "${table}" FOR ALL USING (company_id::text = current_setting('app.current_company_id', true));`
    );
  });

  it("partial unique indexes match schema.ts .where", () => {
    expect(sqlText).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "crews_company_name_idx" ON "crews" USING btree ("company_id","name") WHERE "deleted_at" IS NULL;');
    expect(schemaText).toContain('uniqueIndex("crews_company_name_idx").on(t.companyId, t.name).where(sql`"deleted_at" IS NULL`)');
    expect(sqlText).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "crew_members_crew_technician_idx" ON "crew_members" USING btree ("crew_id","technician_id") WHERE "deleted_at" IS NULL;');
    expect(schemaText).toContain('uniqueIndex("crew_members_crew_technician_idx").on(t.crewId, t.technicianId).where(sql`"deleted_at" IS NULL`)');
  });
});
