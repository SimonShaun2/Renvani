#!/usr/bin/env node
/** FS-229: one six-concurrent inquiry test on this run's disposable staging Neon database. */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateNeonCiDatabaseUrl } from "../../packages/config/dist/neon-ci.js";
import { isApprovedNeonTesterTarget } from "./approved-neon-tester-target.mjs";
import { prNumberFromGithubRef, redactDatabaseUrls, withStrictIsolatedCiDatabase } from "./neon-per-pr-database.mjs";
import { assertOnePassingVitestResult, runSilentVitest, runVitestJsonGate } from "./strict-vitest-json.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const postgres = createRequire(join(repoRoot, "packages/db/package.json"))("postgres");
const baseUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const validation = validateNeonCiDatabaseUrl(process.env);
let parsedUrl = null;
try {
  parsedUrl = baseUrl ? new URL(baseUrl) : null;
} catch {
  // The common gate below reports an error without printing the URL.
}

if (
  process.version !== "v22.16.0" ||
  process.env.GITHUB_EVENT_NAME !== "pull_request" ||
  process.env.GITHUB_HEAD_REF !== "codex/growth-trade-inquiry" ||
  !process.env.FS229_PR_NUMBER ||
  prNumberFromGithubRef(process.env.GITHUB_REF) !== process.env.FS229_PR_NUMBER ||
  process.env.RENVANI_DEPLOYMENT_TIER !== "staging" ||
  !baseUrl || !validation.ok || validation.mode !== "staging" ||
  !parsedUrl || !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
  !isApprovedNeonTesterTarget(parsedUrl)
) {
  console.error("[fs229-postgres] invalid or missing approved staging Neon CI target");
  process.exit(1);
}

function migrate(childEnv) {
  const result = spawnSync("corepack", ["pnpm", "--filter", "@fsm/db", "run", "db:migrate"], {
    cwd: repoRoot, env: childEnv, stdio: "ignore", shell: false
  });
  if (result.status !== 0) throw new Error(`migration failed with exit status ${Number.isSafeInteger(result.status) ? result.status : "unknown"}`);
}

const baseSql = postgres(baseUrl, { max: 1, onnotice: () => undefined });
try {
  await withStrictIsolatedCiDatabase({
    baseUrl,
    sql: baseSql,
    env: process.env,
    prNumber: process.env.FS229_PR_NUMBER,
    nowEpochSeconds: Math.floor(Date.now() / 1000),
    runSteps: async (childUrl) => {
      const childEnv = { ...process.env, DATABASE_URL: childUrl, NEON_CI_DATABASE_URL: childUrl, RENVANI_DEPLOYMENT_TIER: "staging" };
      const outputFile = join(tmpdir(), `renvani-fs229-pg-${randomUUID()}.json`);
      migrate(childEnv);
      runVitestJsonGate({
        outputFile,
        runTest: () => runSilentVitest(
          "corepack",
          ["pnpm", "--filter", "@fsm/api", "exec", "vitest", "run", "src/services/revenue-inquiry-idempotency.postgres.integration.test.ts", "--reporter=json", `--outputFile=${outputFile}`],
          childEnv,
          repoRoot
        ),
        verifyResult: assertOnePassingVitestResult
      });
    }
  });
  console.log("[fs229-postgres] isolated database created, 1 executed / 1 passed / 0 skipped, and dropped");
} catch (error) {
  console.error(`[fs229-postgres] FAIL: ${redactDatabaseUrls(error?.message)}`);
  process.exitCode = 1;
} finally {
  await baseSql.end({ timeout: 5 }).catch(() => {
    console.error("[fs229-postgres] FAIL: base database connection cleanup failed");
    process.exitCode = 1;
  });
}
