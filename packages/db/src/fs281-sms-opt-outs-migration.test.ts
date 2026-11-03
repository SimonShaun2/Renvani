import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const packageRoot = join(import.meta.dirname, "..");
// Journal idx 63: 0062 is reserved by open PR #430 (FS-234 consent ledger, when 1793712733207); merge after it.
const TAG = "0063_fs281_sms_opt_outs";
const FS234_RESERVED_WHEN = 1793712733207;
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");
const schemaText = readFileSync(join(packageRoot, "src", "schema.ts"), "utf8");

describe("FS-281 sms_opt_outs migration (platform table)", () => {
  it("is journaled at idx 63 with `when` later than every prior entry and the reserved 0062", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry?.idx).toBe(63);
    expect(entry!.when).toBeGreaterThan(FS234_RESERVED_WHEN);
    for (const prior of journal.entries.filter((e) => e.idx < 63)) expect(entry!.when).toBeGreaterThan(prior.when);
  });

  it("is additive and re-runnable", () => {
    expect(sqlText).not.toMatch(/CREATE TYPE|DROP |ALTER TABLE|TRUNCATE|DELETE /i);
    expect(sqlText).toContain('CREATE TABLE IF NOT EXISTS "sms_opt_outs"');
    expect(sqlText).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS "sms_opt_outs_phone_e164_idx"/);
  });

  it("is platform-level: no company_id, no tenant policy (shared-number STOP ruling, #295)", () => {
    expect(sqlText).not.toContain("company_id");
    expect(sqlText).not.toContain("tenant_isolation_sms_opt_outs");
    expect(schemaText).toContain('pgTable("sms_opt_outs"');
  });
});
