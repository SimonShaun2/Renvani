import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { clerkWorkspaceIntentEvents, clerkWorkspaceIntents } from "./schema.js";

const packageRoot = join(import.meta.dirname, "..");
const TAG = "0061_fs235_clerk_workspace_intent";
const sqlText = readFileSync(join(packageRoot, "migrations", `${TAG}.sql`), "utf8");

describe("FS-235 Clerk workspace intent migration", () => {
  it("is the contiguous migration after current dev and is later than every prior entry", () => {
    const journal = JSON.parse(
      readFileSync(join(packageRoot, "migrations", "meta", "_journal.json"), "utf8")
    ) as { entries: Array<{ idx: number; tag: string; when: number }> };
    const entry = journal.entries.find((candidate) => candidate.tag === TAG);
    expect(entry?.idx).toBe(61);
    expect(journal.entries.map((candidate) => candidate.idx))
      .toEqual(journal.entries.map((_, index) => index));
    for (const prior of journal.entries.filter((candidate) => candidate.idx < 61)) {
      expect(entry!.when).toBeGreaterThan(prior.when);
    }
  });

  it("is additive and preserves the immutable user/attempt/org guards", () => {
    expect(sqlText).not.toMatch(/(^|\n)\s*(DROP|TRUNCATE|DELETE)\s/i);
    expect(sqlText).toContain('CREATE TABLE IF NOT EXISTS "clerk_workspace_intents"');
    expect(sqlText).toContain('CREATE TABLE IF NOT EXISTS "clerk_workspace_intent_events"');
    expect(sqlText).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "clerk_workspace_intents_clerk_user_idx"');
    expect(sqlText).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "clerk_workspace_intents_attempt_idx"');
    expect(sqlText).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "clerk_workspace_intents_clerk_org_idx"');
  });

  it("matches the authoritative schema", () => {
    expect(getTableConfig(clerkWorkspaceIntents).name).toBe("clerk_workspace_intents");
    expect(getTableConfig(clerkWorkspaceIntentEvents).name).toBe("clerk_workspace_intent_events");
    expect(getTableConfig(clerkWorkspaceIntents).columns.map((column) => column.name))
      .toEqual(expect.arrayContaining(["clerk_user_id", "attempt_id", "clerk_organization_id", "deleted_at"]));
  });
});
