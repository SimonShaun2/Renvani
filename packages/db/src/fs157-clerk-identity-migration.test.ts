import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0038_fs157_clerk_identity";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");

describe("FS-157 clerk identity migration", () => {
  it("is the next journal entry after 0037 and passes the repo migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const last = journal.entries.at(-1);
    expect(last).toMatchObject({ idx: 38, tag: TAG });
    expect(journal.entries.at(-2)?.tag).toBe("0037_user_email_verification");
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("adds users.clerk_user_id idempotently with a partial unique index", () => {
    expect(sqlText).toContain('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_user_id" varchar(255)');
    expect(sqlText).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "users_clerk_user_id_idx" ON "users" USING btree \("clerk_user_id"\) WHERE "clerk_user_id" IS NOT NULL/
    );
  });

  it("creates the Clerk org unique index only when existing data has no duplicates", () => {
    expect(sqlText).toContain("HAVING count(*) > 1");
    expect(sqlText).toContain("RAISE WARNING");
    expect(sqlText).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS "companies_clerk_organization_id_idx" ON "companies" USING btree \(\("settings" -> 'clerk' ->> 'organizationId'\)\) WHERE "deleted_at" IS NULL/
    );
  });

  it("is purely additive (no drops, no backfill of data)", () => {
    expect(sqlText).not.toMatch(/^\s*(DROP|DELETE|UPDATE|TRUNCATE)\b/im);
  });
});
