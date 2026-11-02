import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { isApprovedFs235NeonTarget } from "./fs235-neon-target.mjs";
import { runVitestJsonGate, vitestFailureSummary } from "./fs235-vitest-diagnostics.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("FS-235 strict target pin accepts only the approved tester endpoint host", () => {
  const approved = "ep-floral-forest-b5kvzc7b-pooler.c-7.us-east-2.aws.neon.tech";
  assert.equal(isApprovedFs235NeonTarget(new URL(`postgresql://u:p@${approved}/neondb`)), true);
  assert.equal(isApprovedFs235NeonTarget(new URL("postgresql://u:p@ep-floral-forest-b5kvzc7b.c-7.us-east-2.aws.neon.tech/neondb")), false);
  assert.equal(isApprovedFs235NeonTarget(new URL("postgresql://u:p@ep-production-pooler.c-7.us-east-2.aws.neon.tech/neondb")), false);
  assert.equal(isApprovedFs235NeonTarget(new URL(`postgresql://u:p@${approved}.attacker.example/neondb`)), false);
  assert.equal(isApprovedFs235NeonTarget(null), false);
});

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
  assert.match(workflow, /node-version: 22\.16\.0[\s\S]*fs235-clerk-workspace-postgres\.mjs/);
  assert.match(workflow, /FS235_PR_NUMBER: \$\{\{ github\.event\.pull_request\.number \}\}/);
});

test("FS-235 runner reports structured diagnostics without reporter credentials or PII", () => {
  const directory = mkdtempSync(join(tmpdir(), "fs235-vitest-failure-"));
  const outputFile = join(directory, "result.json");
  const databaseUrl = "postgresql://ci_user:super-secret@approved.neon.tech/ci_pr_411_2_1800000000?sslmode=require";
  writeFileSync(outputFile, JSON.stringify({
    numTotalTests: 1,
    numPassedTests: 0,
    numFailedTests: 1,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [{
      assertionResults: [{
        status: "failed",
        fullName: "FS-235 Clerk workspace worker (Postgres) authorizes exactly one provider create across concurrent workers",
        failureMessages: [
          `AssertionError: owner@example.com used token sk_test_standalone and connection ${databaseUrl} timed out\n`
          + "    at C:/runner/src/processors/clerk-workspace.postgres.integration.test.ts:21:7"
        ]
      }]
    }]
  }));
  const logs = [];

  try {
    assert.throws(() => runVitestJsonGate({
      outputFile,
      runTest: () => { throw new Error("Vitest exited 1"); },
      verifyResult: () => { throw new Error("must not verify after a failed subprocess"); },
      log: (line) => logs.push(line)
    }), /Vitest exited 1/);
    assert.match(logs.join("\n"), /assertion=fs235_concurrent_claim/);
    assert.match(logs.join("\n"), /type=AssertionError kind=timeout/);
    assert.match(logs.join("\n"), /location=clerk-workspace\.postgres\.integration\.test\.ts:21:7/);
    assert.doesNotMatch(
      logs.join("\n"),
      /super-secret|ci_pr_411_2_1800000000|approved\.neon\.tech|owner@example\.com|sk_test_standalone/
    );
    assert.equal(existsSync(outputFile), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("FS-235 runner bounds message count and total output while suppressing arbitrary reporter text", () => {
  const directory = mkdtempSync(join(tmpdir(), "fs235-vitest-bounds-"));
  const outputFile = join(directory, "result.json");
  const failureMessages = Array.from(
    { length: 100 },
    (_, index) => `Error: message ${index} user${index}@example.com token_${index}_${"x".repeat(5_000)}`
  );
  writeFileSync(outputFile, JSON.stringify({
    numTotalTests: "attacker@example.com",
    numPassedTests: 0,
    numFailedTests: 1,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [{
      assertionResults: [{
        status: "failed",
        fullName: "private customer name and token_unsafe",
        failureMessages
      }]
    }]
  }));

  try {
    const summary = vitestFailureSummary(outputFile);
    assert.ok(summary.length <= 2_000);
    assert.match(summary, /"executed":"unknown"/);
    assert.match(summary, /assertion=unknown/);
    assert.match(summary, /messages=3 messages_omitted=true/);
    assert.doesNotMatch(summary, /attacker@example\.com|user0@example\.com|token_0_|private customer|token_unsafe/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("FS-235 runner cleans a successful Vitest JSON result after verification", () => {
  const directory = mkdtempSync(join(tmpdir(), "fs235-vitest-success-"));
  const outputFile = join(directory, "result.json");
  writeFileSync(outputFile, "{}");
  let verified = false;

  try {
    runVitestJsonGate({
      outputFile,
      runTest: () => undefined,
      verifyResult: (path) => {
        verified = true;
        assert.equal(path, outputFile);
        assert.equal(existsSync(path), true);
      },
      log: () => { throw new Error("success must not log a failure"); }
    });
    assert.equal(verified, true);
    assert.equal(existsSync(outputFile), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// ── Per-PR database isolation (no live DB: SQL client is a fake) ──
import {
  buildCiDatabaseName,
  buildChildDatabaseUrl,
  dropStaleCiDatabases,
  maskDatabaseUrls,
  redactDatabaseUrls,
  parseCiDatabaseEpoch,
  prNumberFromGithubRef,
  withIsolatedCiDatabase,
  withStrictIsolatedCiDatabase
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

test("strict redaction removes the entire derived connection URL", () => {
  const masked = redactDatabaseUrls("connect postgresql://u:p@ep-staging.neon.tech/ci_pr_411_1_1800000000?sslmode=require failed");
  assert.equal(masked, "connect [REDACTED_DATABASE_URL] failed");
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

test("FS-235 strict gate creates and drops only its own database, with no stale sweep", async () => {
  const sql = fakeSql({ databases: [`ci_pr_other_1_${NOW - 7 * 3600}`] });
  const seen = [];
  const result = await withStrictIsolatedCiDatabase({
    baseUrl: "postgres://u:p@ep-staging.neon.tech/neondb",
    sql,
    env: { GITHUB_RUN_ID: "12345", GITHUB_RUN_ATTEMPT: "2" },
    nowEpochSeconds: NOW,
    runSteps: async (url) => seen.push(new URL(url).pathname),
    log: () => undefined
  });
  assert.equal(result.mode, "isolated");
  assert.deepEqual(seen, [`/ci_pr_411_12345_2_${NOW}`]);
  assert.deepEqual(sql.calls.filter((call) => /database/i.test(call)), [
    `create database "ci_pr_411_12345_2_${NOW}"`,
    `drop database if exists "ci_pr_411_12345_2_${NOW}" with (force)`
  ]);
});

test("FS-235 strict gate rejects missing CREATEDB and CREATE failure without shared fallback", async () => {
  for (const sql of [
    fakeSql({ createdb: false }),
    fakeSql({ createError: Object.assign(new Error("permission denied"), { code: "42501" }) })
  ]) {
    let ran = false;
    await assert.rejects(withStrictIsolatedCiDatabase({
      baseUrl: "postgres://u:p@ep-staging.neon.tech/neondb",
      sql,
      env: { GITHUB_RUN_ID: "12345", GITHUB_RUN_ATTEMPT: "1" },
      nowEpochSeconds: NOW,
      runSteps: async () => { ran = true; },
      log: () => undefined
    }), /CREATEDB|could not create/);
    assert.equal(ran, false);
    assert.ok(!sql.calls.some((call) => call.startsWith("select datname")));
    assert.ok(!sql.calls.some((call) => call.startsWith("drop database")));
  }
});

test("FS-235 strict gate drops its own database after test failure and fails on cleanup error", async () => {
  const sql = fakeSql();
  await assert.rejects(withStrictIsolatedCiDatabase({
    baseUrl: "postgres://u:p@ep-staging.neon.tech/neondb",
    sql,
    env: { GITHUB_RUN_ID: "12345", GITHUB_RUN_ATTEMPT: "1" },
    nowEpochSeconds: NOW,
    runSteps: async () => { throw new Error("worker test failed"); },
    log: () => undefined
  }), /worker test failed/);
  assert.ok(sql.calls.includes(`drop database if exists "ci_pr_411_12345_1_${NOW}" with (force)`));

  const dropFailure = fakeSql();
  const unsafe = dropFailure.unsafe;
  dropFailure.unsafe = async (text) => {
    if (text.startsWith("drop database")) throw new Error("cannot drop");
    return unsafe(text);
  };
  await assert.rejects(withStrictIsolatedCiDatabase({
    baseUrl: "postgres://u:p@ep-staging.neon.tech/neondb",
    sql: dropFailure,
    env: { GITHUB_RUN_ID: "12345", GITHUB_RUN_ATTEMPT: "1" },
    nowEpochSeconds: NOW,
    runSteps: async () => undefined,
    log: () => undefined
  }), /failed to drop strict isolated CI database/);
});
