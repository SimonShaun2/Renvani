/**
 * PR #445 — run the workflow-read PostgreSQL suites (estimate groups, weekly dispatch, workflow reads)
 * against the per-PR database the existing Neon job already creates. No workflow or secret change:
 * neon-per-pr-branch.mjs calls this inside withIsolatedCiDatabase after migrations.
 *
 * Gate: every test must execute (0 skipped, 0 failed). On the shared-staging fallback these suites are NOT run
 * (they write fixture rows) and the result is logged as NOT PROVEN.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runSilentVitest, runVitestJsonGate } from "./strict-vitest-json.mjs";

export const WORKFLOW_READ_SUITES = [
  "src/services/estimate-groups.postgres.integration.test.ts",
  "src/services/dispatch-week.postgres.integration.test.ts",
  "src/services/workflow-reads.postgres.integration.test.ts"
];

export function workflowReadsEnv(baseEnv, databaseUrl) {
  return {
    ...baseEnv,
    WORKFLOW_TEST_DATABASE_URL: databaseUrl,
    WORKFLOW_FULL_DATABASE_URL: databaseUrl
  };
}

export function assertAllExecuted(outputFile, readCounts) {
  const result = readCounts(outputFile);
  if (!(result.total > 0) || result.passed !== result.total || result.failed !== 0 || result.skipped !== 0 || result.todo !== 0) {
    throw new Error("workflow-read PostgreSQL suites did not all execute and pass (skips are failures)");
  }
  return result;
}

export function runWorkflowReadsSuites({ repoRoot, databaseUrl, isolated, env = process.env, log = console.log }) {
  if (!isolated) {
    log("[workflow-reads-postgres] NOT PROVEN: shared-staging fallback; suites skipped to avoid writing fixtures to shared staging.");
    return { ran: false };
  }
  const build = spawnSync("corepack", ["pnpm", "--filter", "@fsm/api^...", "build"], { cwd: repoRoot, env, stdio: "inherit", shell: false });
  if (build.status !== 0) throw new Error("API dependency build failed");
  const outputFile = join(mkdtempSync(join(tmpdir(), "workflow-reads-")), "result.json");
  const childEnv = workflowReadsEnv(env, databaseUrl);
  let counted;
  runVitestJsonGate({
    outputFile,
    runTest: () =>
      runSilentVitest(
        "corepack",
        ["pnpm", "--filter", "@fsm/api", "exec", "vitest", "run", ...WORKFLOW_READ_SUITES, "--reporter=json", `--outputFile=${outputFile}`],
        childEnv,
        repoRoot
      ),
    verifyResult: (file) => {
      counted = assertAllExecuted(file, readJsonCounts);
    }
  });
  log(`[workflow-reads-postgres] OK ${JSON.stringify(counted)}`);
  return { ran: true, ...counted };
}

function readJsonCounts(file) {
  const r = JSON.parse(readFileSync(file, "utf8"));
  return { total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests, todo: r.numTodoTests };
}
