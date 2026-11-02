import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { isApprovedNeonTesterTarget } from "./approved-neon-tester-target.mjs";
import { redactDatabaseUrls, withStrictIsolatedCiDatabase } from "./neon-per-pr-database.mjs";
import { assertOnePassingVitestResult, runVitestJsonGate } from "./strict-vitest-json.mjs";

const baseUrl = "postgres://user:secret@ep-floral-forest-b5kvzc7b-pooler.c-7.us-east-2.aws.neon.tech/staging?sslmode=require";
const env = { GITHUB_RUN_ID: "42", GITHUB_RUN_ATTEMPT: "1" };

test("strict FS-229 gate creates and drops only its own child database", async () => {
  const statements = [];
  const sql = { unsafe: async (statement) => {
    statements.push(statement);
    return statement.startsWith("select rolcreatedb") ? [{ rolcreatedb: true, rolsuper: false }] : [];
  } };
  let childUrl;
  const result = await withStrictIsolatedCiDatabase({
    baseUrl, sql, env, prNumber: "417", nowEpochSeconds: 1_762_109_000,
    runSteps: async (url) => { childUrl = url; }, log: () => undefined
  });
  assert.equal(result.mode, "isolated");
  assert.match(result.databaseName, /^ci_pr_417_42_1_/);
  assert.equal(new URL(childUrl).hostname, new URL(baseUrl).hostname);
  assert.equal(new URL(childUrl).pathname, `/${result.databaseName}`);
  assert.equal(statements.filter((statement) => statement.startsWith("create database")).length, 1);
  assert.equal(statements.filter((statement) => statement.startsWith("drop database")).length, 1);
  assert.equal(statements.some((statement) => statement.includes("pg_database")), false);
});

test("strict gate refuses shared fallback and treats cleanup failure as fatal", async () => {
  const denied = { unsafe: async () => [{ rolcreatedb: false, rolsuper: false }] };
  await assert.rejects(withStrictIsolatedCiDatabase({ baseUrl, sql: denied, env, prNumber: "417", nowEpochSeconds: 1_762_109_000, runSteps: async () => { throw new Error("must not run"); } }), /CREATEDB/);
  const sql = { unsafe: async (statement) => {
    if (statement.startsWith("select rolcreatedb")) return [{ rolcreatedb: true, rolsuper: false }];
    if (statement.startsWith("drop database")) throw new Error("unsafe details");
    return [];
  } };
  await assert.rejects(withStrictIsolatedCiDatabase({ baseUrl, sql, env, prNumber: "417", nowEpochSeconds: 1_762_109_000, runSteps: async () => {}, log: () => undefined }), /failed to drop strict isolated CI database/);
});

test("tester host pin and full URL redaction exclude other branches and secrets", () => {
  assert.equal(isApprovedNeonTesterTarget(new URL(baseUrl)), true);
  assert.equal(isApprovedNeonTesterTarget(new URL("postgres://user:secret@ep-other.neon.tech/staging")), false);
  const redacted = redactDatabaseUrls(`failed ${baseUrl}`);
  assert.equal(redacted.includes("secret"), false);
  assert.equal(redacted.includes("staging"), false);
});

test("Vitest JSON requires one executed and passed test and deletes its report", () => {
  const dir = mkdtempSync(join(tmpdir(), "fs229-json-"));
  const file = join(dir, "result.json");
  try {
    writeFileSync(file, JSON.stringify({ numTotalTests: 1, numPassedTests: 0, numFailedTests: 0, numPendingTests: 1, numTodoTests: 0, testResults: [{ failureMessages: [baseUrl] }] }));
    const logs = [];
    assert.throws(() => runVitestJsonGate({ outputFile: file, runTest: () => {}, verifyResult: assertOnePassingVitestResult, log: (message) => logs.push(message) }), /not 1 executed/);
    assert.equal(existsSync(file), false);
    assert.equal(logs.join(" ").includes("secret"), false);
    writeFileSync(file, JSON.stringify({ numTotalTests: 1, numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0 }));
    assertOnePassingVitestResult(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("approved batch workflow limits FS-229 gate to the existing PR branch", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/batch-ci.yml", import.meta.url), "utf8");
  assert.match(workflow, /FS-229 strict inquiry concurrency/);
  assert.match(workflow, /github\.event\.pull_request\.head\.ref == 'codex\/growth-trade-inquiry'/);
  assert.match(workflow, /FS229_PR_NUMBER: \$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(workflow, /node-version: 22\.16\.0/);
});
