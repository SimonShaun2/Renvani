/**
 * PR #445 — run the workflow-read PostgreSQL suites (estimate groups, weekly dispatch, workflow reads)
 * against the per-PR database the existing Neon job already creates. No workflow or secret change:
 * neon-per-pr-branch.mjs calls this inside withIsolatedCiDatabase after migrations.
 *
 * Gate: every test must execute (0 skipped, 0 failed) with pinned per-suite counts. A non-isolated (shared-staging
 * fallback) run FAILS the gate as NOT PROVEN; the suites are never run against shared staging.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runVitestJsonGate } from "./strict-vitest-json.mjs";

export const WORKFLOW_READ_SUITES = [
  "src/services/estimate-groups.postgres.integration.test.ts",
  "src/services/dispatch-week.postgres.integration.test.ts",
  "src/services/workflow-reads.postgres.integration.test.ts"
];

/**
 * Neon's "-pooler" endpoint is PgBouncer in transaction mode: session state (SET search_path, set_config(..., false),
 * temp schemas) does not survive between statements. These suites create per-run schemas and rely on session state,
 * so they must use the direct (unpooled) endpoint of the same database and role. Same secret, no credential change.
 */
export function directEndpointUrl(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }
  const [first, ...rest] = parsed.hostname.split(".");
  if (!first.endsWith("-pooler") || !parsed.hostname.endsWith(".neon.tech")) return databaseUrl;
  parsed.hostname = [first.slice(0, -"-pooler".length), ...rest].join(".");
  return parsed.toString();
}

/** Pinned per-suite executed+passed counts; a drop (or rise) fails the gate until this pin is updated deliberately. */
export const EXPECTED_SUITE_COUNTS = {
  "estimate-groups.postgres.integration.test.ts": 12,
  "dispatch-week.postgres.integration.test.ts": 8,
  "workflow-reads.postgres.integration.test.ts": 23
};

export function assertPinnedSuiteCounts(summary) {
  for (const [file, expected] of Object.entries(EXPECTED_SUITE_COUNTS)) {
    const line = summary.find((entry) => entry.file === file);
    if (!line || line.passed !== expected || line.failed !== 0 || line.skipped !== 0) {
      throw new Error(`workflow-read suite ${file} did not execute exactly ${expected} passing tests`);
    }
  }
}

export class WorkflowReadsNotProvenError extends Error {
  constructor() {
    super("NOT PROVEN: per-PR database isolation unavailable (no CREATEDB / CREATE DATABASE denied); workflow-read PostgreSQL suites are never run on shared staging, so the gate fails");
    this.name = "WorkflowReadsNotProvenError";
  }
}

export function workflowReadsEnv(baseEnv, databaseUrl) {
  const direct = directEndpointUrl(databaseUrl);
  return {
    ...baseEnv,
    DATABASE_URL: direct,
    WORKFLOW_TEST_DATABASE_URL: direct,
    WORKFLOW_FULL_DATABASE_URL: direct
  };
}

/** Error class names, network error codes and SQLSTATE codes found in captured output. Never messages or values. */
export function safeErrorClasses(text) {
  const source = typeof text === "string" ? text.slice(0, 4_000_000) : "";
  const names = [...new Set(source.match(/\b(?:PostgresError|AssertionError|TypeError|ZodError|SyntaxError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|CONNECT_TIMEOUT|Hook timed out)\b/gu) ?? [])].slice(0, 10);
  const sqlstate = [...new Set([...source.matchAll(/\bcode: ['"]([0-9A-Z]{5})['"]/gu)].map((m) => m[1]))].slice(0, 10);
  return { names, sqlstate };
}

/** Per-file counts plus error class and SQLSTATE only: never messages, values or URLs. */
export function safeFailureSummary(file) {
  let result;
  try {
    result = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return [];
  }
  const files = Array.isArray(result?.testResults) ? result.testResults.slice(0, 10) : [];
  return files.map((entry) => {
    const name = typeof entry?.name === "string" ? (entry.name.match(/[\w.-]+\.postgres\.integration\.test\.ts$/u)?.[0] ?? "unknown") : "unknown";
    const assertions = Array.isArray(entry?.assertionResults) ? entry.assertionResults : [];
    const count = (status) => assertions.filter((a) => a?.status === status).length;
    const text = [entry?.message, ...assertions.flatMap((a) => (Array.isArray(a?.failureMessages) ? a.failureMessages : []))]
      .filter((m) => typeof m === "string")
      .map((m) => m.slice(0, 2000))
      .join("\n");
    const sqlstate = [...new Set([...text.matchAll(/\bcode: '([0-9A-Z]{5})'/gu)].map((m) => m[1]))].slice(0, 5);
    const kind = /PostgresError/u.test(text) ? "PostgresError" : /AssertionError/u.test(text) ? "AssertionError" : /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/u.test(text) ? "ConnectionError" : text ? "Error" : "none";
    return { file: name, passed: count("passed"), failed: count("failed"), skipped: count("skipped") + count("pending"), kind, sqlstate };
  });
}

export function assertAllExecuted(outputFile, readCounts) {
  const result = readCounts(outputFile);
  if (!(result.total > 0) || result.passed !== result.total || result.failed !== 0 || result.skipped !== 0 || result.todo !== 0) {
    throw new Error("workflow-read PostgreSQL suites did not all execute and pass (skips are failures)");
  }
  return result;
}

export function runWorkflowReadsSuites({ repoRoot, databaseUrl, isolated, env = process.env, log = console.log }) {
  if (isolated !== true) {
    const error = new WorkflowReadsNotProvenError();
    log(`[workflow-reads-postgres] ${error.message}`);
    throw error;
  }
  const build = spawnSync("corepack", ["pnpm", "--filter", "@fsm/api^...", "build"], { cwd: repoRoot, env, stdio: "inherit", shell: false });
  if (build.status !== 0) throw new Error("API dependency build failed");
  const outputFile = join(mkdtempSync(join(tmpdir(), "workflow-reads-")), "result.json");
  const childEnv = workflowReadsEnv(env, databaseUrl);
  let counted;
  runVitestJsonGate({
    outputFile,
    runTest: () => {
      // Output is captured in memory only; just error classes and SQLSTATE codes are ever logged.
      const run = spawnSync(
        "corepack",
        ["pnpm", "--filter", "@fsm/api", "exec", "vitest", "run", ...WORKFLOW_READ_SUITES, "--reporter=json", `--outputFile=${outputFile}`, "--reporter=default"],
        { cwd: repoRoot, env: childEnv, stdio: ["ignore", "pipe", "pipe"], shell: false, maxBuffer: 64 * 1024 * 1024, encoding: "utf8" }
      );
      if (run.status !== 0) {
        for (const line of safeFailureSummary(outputFile)) log(`[workflow-reads-postgres] ${JSON.stringify(line)}`);
        log(`[workflow-reads-postgres] error classes ${JSON.stringify(safeErrorClasses(`${run.stdout ?? ""}\n${run.stderr ?? ""}`))}`);
        throw new Error(`Vitest exited with status ${Number.isSafeInteger(run.status) ? run.status : "unknown"}`);
      }
    },
    verifyResult: (file) => {
      try {
        counted = assertAllExecuted(file, readJsonCounts);
        assertPinnedSuiteCounts(safeFailureSummary(file));
      } catch (error) {
        for (const line of safeFailureSummary(file)) log(`[workflow-reads-postgres] ${JSON.stringify(line)}`);
        throw error;
      }
    }
  });
  log(`[workflow-reads-postgres] OK ${JSON.stringify(counted)}`);
  return { ran: true, ...counted };
}

function readJsonCounts(file) {
  const r = JSON.parse(readFileSync(file, "utf8"));
  return { total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests, todo: r.numTodoTests };
}
