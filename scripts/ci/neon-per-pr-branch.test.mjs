import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("neon-per-pr-branch script documents staging-only policy", () => {
  const script = readFileSync(join(repoRoot, "scripts/ci/neon-per-pr-branch.mjs"), "utf8");
  assert.match(script, /staging-only/i);
  assert.match(script, /validateNeonCiDatabaseUrl/);
  assert.match(script, /db:migrate/, "Neon gate must apply migrations before RLS integration tests");
});

test("batch-ci workflow includes neon per-PR matrix job", () => {
  const workflow = readFileSync(join(repoRoot, ".github/workflows/batch-ci.yml"), "utf8");
  assert.match(workflow, /neon-per-pr-branch\.mjs/);
  assert.match(workflow, /NEON_CI_STAGING_DATABASE_URL/);
  assert.match(workflow, /golden-import-e2e\.mjs/, "Neon job must run FS-152 golden import e2e");
  assert.match(
    workflow,
    /@fsm\/db\.\.\./,
    "Neon job must build @fsm/db workspace dependencies (e.g. @fsm/types) before tsc"
  );
});

// ── Per-PR database isolation (no live DB: SQL client is a fake) ──
import {
  buildCiDatabaseName,
  buildChildDatabaseUrl,
  dropStaleCiDatabases,
  maskDatabaseUrls,
  parseCiDatabaseEpoch,
  prNumberFromGithubRef,
  withIsolatedCiDatabase
} from "./neon-per-pr-database.mjs";

const NOW = 1_800_000_000;

function fakeSql({ createdb = true, superuser = false, databases = [], createError = null } = {}) {
  const calls = [];
  const sql = {
    calls,
    async unsafe(text) {
      calls.push(text);
      if (text.startsWith("select rolcreatedb")) return [{ rolcreatedb: createdb, rolsuper: superuser }];
      if (text.startsWith("select datname")) return databases.map((datname) => ({ datname }));
      if (text.startsWith("create database") && createError) throw createError;
      return [];
    }
  };
  return sql;
}

test("database name: lowercase, [a-z0-9_] only, capped at 63, epoch suffix kept", () => {
  assert.equal(buildCiDatabaseName({ prNumber: "173", runAttempt: "2", nowEpochSeconds: NOW }), `ci_pr_173_2_${NOW}`);
  assert.equal(buildCiDatabaseName({ runId: "Run-99;DROP", runAttempt: undefined, nowEpochSeconds: NOW }), `ci_pr_run_99_drop_1_${NOW}`);
  const long = buildCiDatabaseName({ prNumber: "x".repeat(200), runAttempt: "1", nowEpochSeconds: NOW });
  assert.ok(long.length <= 63);
  assert.match(long, /^ci_pr_[a-z0-9_]+$/);
  assert.equal(parseCiDatabaseEpoch(long), NOW);
  assert.equal(prNumberFromGithubRef("refs/pull/311/merge"), "311");
  assert.equal(prNumberFromGithubRef("refs/heads/dev"), undefined);
});

test("child URL swaps only the database; special-char passwords stay intact", () => {
  const base = "postgresql://ci_user:p%40ss%2Fw%3Ard%23%3F@ep-staging-1.neon.tech/neondb?sslmode=require";
  const child = new URL(buildChildDatabaseUrl(base, `ci_pr_1_1_${NOW}`));
  assert.equal(child.pathname, `/ci_pr_1_1_${NOW}`);
  assert.equal(decodeURIComponent(child.password), "p@ss/w:rd#?");
  assert.equal(child.username, "ci_user");
  assert.equal(child.hostname, "ep-staging-1.neon.tech");
  assert.equal(child.searchParams.get("sslmode"), "require");
  assert.throws(() => buildChildDatabaseUrl(base, 'neondb"; drop'), /unsafe/);
});

test("masking removes credentials from URLs in log text", () => {
  const masked = maskDatabaseUrls("connect postgres://u:s3cr%40t@host/db failed");
  assert.equal(masked, "connect postgres://***@host/db failed");
  assert.doesNotMatch(masked, /s3cr/);
});

test("isolated run: creates, runs steps against the child, drops WITH (FORCE) in finally", async () => {
  const sql = fakeSql();
  const seen = [];
  const result = await withIsolatedCiDatabase({
    baseUrl: "postgres://u:p@ep-staging.neon.tech/neondb",
    sql,
    env: { NEON_CI_PR_NUMBER: "173", GITHUB_RUN_ATTEMPT: "1" },
    nowEpochSeconds: NOW,
    runSteps: async (url) => seen.push(new URL(url).pathname),
    log: () => undefined
  });
  assert.equal(result.mode, "isolated");
  assert.deepEqual(seen, [`/ci_pr_173_1_${NOW}`]);
  assert.ok(sql.calls.includes(`create database "ci_pr_173_1_${NOW}"`));
  assert.ok(sql.calls.includes(`drop database if exists "ci_pr_173_1_${NOW}" with (force)`));
});

test("cleanup still runs when a step fails", async () => {
  const sql = fakeSql();
  await assert.rejects(
    withIsolatedCiDatabase({
      baseUrl: "postgres://u:p@ep-staging.neon.tech/neondb",
      sql,
      env: { NEON_CI_PR_NUMBER: "9" },
      nowEpochSeconds: NOW,
      runSteps: async () => {
        throw new Error("db:migrate failed");
      },
      log: () => undefined
    }),
    /db:migrate failed/
  );
  assert.ok(sql.calls.some((c) => c.startsWith(`drop database if exists "ci_pr_9_1_${NOW}"`)));
});

test("no CREATEDB: falls back to the shared DB with a clear log, no create, no hard failure", async () => {
  for (const sql of [fakeSql({ createdb: false }), fakeSql({ createError: Object.assign(new Error("permission denied to create database"), { code: "42501" }) })]) {
    const logs = [];
    const seen = [];
    const base = "postgres://u:p@ep-staging.neon.tech/neondb";
    const result = await withIsolatedCiDatabase({ baseUrl: base, sql, env: {}, nowEpochSeconds: NOW, runSteps: async (url) => seen.push(url), log: (l) => logs.push(l) });
    assert.equal(result.mode, "shared");
    assert.deepEqual(seen, [base]);
    assert.ok(logs.some((l) => /FALLBACK/.test(l)));
    assert.ok(!sql.calls.some((c) => c.startsWith("drop database") && !c.includes("ci_pr_")));
  }
  assert.ok(!fakeSql({ createdb: false }).calls.some((c) => c.startsWith("create database")));
});

test("stale drop: only ci_pr_* older than 6h (by encoded epoch); errors ignored", async () => {
  const sql = fakeSql({ databases: [`ci_pr_1_1_${NOW - 7 * 3600}`, `ci_pr_2_1_${NOW - 3600}`, "ci_pr_manual", "neondb"] });
  const dropped = await dropStaleCiDatabases(sql, { nowEpochSeconds: NOW, log: () => undefined });
  assert.deepEqual(dropped, [`ci_pr_1_1_${NOW - 7 * 3600}`]);
  const broken = { async unsafe() { throw new Error("boom postgres://u:secret@h/db"); } };
  const logs = [];
  assert.deepEqual(await dropStaleCiDatabases(broken, { nowEpochSeconds: NOW, log: (l) => logs.push(l) }), []);
  assert.doesNotMatch(logs.join("\n"), /secret/);
});
