import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateRepoMigrationBundle } from "./migration-safety.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0039_fs160b_clerk_unlink_tombstone";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");

describe("FS-160b clerk unlink tombstone migration", () => {
  it("is the journal entry after 0038 and passes the repo migration safety bundle", () => {
    const journal = JSON.parse(readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const entry = journal.entries.find((e) => e.tag === TAG);
    expect(entry).toMatchObject({ idx: 39, tag: TAG });
    expect(journal.entries[journal.entries.indexOf(entry!) - 1]?.tag).toBe("0038_fs157_clerk_identity");
    expect(validateRepoMigrationBundle(packageRoot).ok).toBe(true);
  });

  it("adds a nullable timestamptz column idempotently and nothing else", () => {
    expect(sqlText).toContain('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_unlinked_at" timestamp with time zone;');
    expect(sqlText).not.toMatch(/NOT NULL|DEFAULT/i);
    expect(sqlText).not.toMatch(/^\s*(DROP|DELETE|UPDATE|TRUNCATE|INSERT)\b/im);
  });
});
