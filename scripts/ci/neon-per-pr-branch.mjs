#!/usr/bin/env node
/**
 * STACK-10 — Neon per-PR branch CI gate (staging-only; no prod Neon).
 * Used by batch-ci matrix when founder provides NEON_CI_STAGING_DATABASE_URL.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { validateNeonCiDatabaseUrl } from "../../packages/config/dist/neon-ci.js";
import { maskDatabaseUrls, prNumberFromGithubRef, withIsolatedCiDatabase } from "./neon-per-pr-database.mjs";
import { runWorkflowReadsSuites } from "./workflow-reads-postgres.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    // Throw (not exit) so the per-PR database is still dropped in the finally block.
    throw Object.assign(new Error(`${args.slice(-1)[0]} failed`), { exitStatus: result.status ?? 1 });
  }
}

/**
 * The gate. Dependencies are injectable for executable caller tests only (PR #445); `main` passes the real ones, so CI
 * behavior is unchanged. Returns the process exit code.
 */
export async function runNeonGate({
  env = process.env,
  runCommand = run,
  runWorkflowReads = runWorkflowReadsSuites,
  createSql = (url) => createRequire(join(repoRoot, "packages/db/package.json"))("postgres")(url, { max: 1, onnotice: () => undefined }),
  log = console.log,
  logError = console.error,
  nowEpochSeconds = Math.floor(Date.now() / 1000)
} = {}) {
  const validation = validateNeonCiDatabaseUrl(env);

  if (!validation.ok) {
    logError(`[neon-per-pr-ci] FAIL ${validation.code}: ${validation.message}`);
    return 1;
  }

  if (validation.mode === "skip") {
    log("[neon-per-pr-ci] SKIP: NEON_CI_DATABASE_URL not set (staging Neon secret optional until founder wires CI).");
    return 0;
  }

  const baseUrl = env.NEON_CI_DATABASE_URL ?? env.DATABASE_URL;

  function stepsAgainst(databaseUrl) {
    const childEnv = {
      ...env,
      DATABASE_URL: databaseUrl,
      NEON_CI_DATABASE_URL: databaseUrl,
      RENVANI_DEPLOYMENT_TIER: env.RENVANI_DEPLOYMENT_TIER ?? "staging"
    };
    runCommand("corepack", ["pnpm", "--filter", "@fsm/db", "run", "db:check-migrations"], childEnv);
    runCommand("corepack", ["pnpm", "--filter", "@fsm/db", "run", "db:migrate"], childEnv);
    runCommand("corepack", ["pnpm", "--filter", "@fsm/db", "test"], childEnv);
    // PR #445: workflow-read PostgreSQL suites on the same migrated per-PR database (isolated mode only).
    // Fail closed: a non-isolated run throws NOT PROVEN; anything but ran === true fails the gate.
    const workflowReads = runWorkflowReads({ repoRoot, databaseUrl, isolated: databaseUrl !== baseUrl, env: childEnv });
    if (workflowReads?.ran !== true) {
      throw Object.assign(new Error("NOT PROVEN: workflow-read PostgreSQL suites did not run"), { exitStatus: 1 });
    }
  }

  log(
    "[neon-per-pr-ci] RUN: migration safety + migrate + @fsm/db tests (RLS matrix) against a per-PR database on staging Neon"
  );

  // postgres.js lives in @fsm/db's dependencies; resolve it from there (repo root has no direct dependency).
  const sql = createSql(baseUrl);

  let exitCode = 0;
  try {
    const result = await withIsolatedCiDatabase({
      baseUrl,
      sql,
      env: { ...env, NEON_CI_PR_NUMBER: env.NEON_CI_PR_NUMBER ?? prNumberFromGithubRef(env.GITHUB_REF) },
      nowEpochSeconds,
      runSteps: async (databaseUrl) => stepsAgainst(databaseUrl),
      log
    });
    log(`[neon-per-pr-ci] OK (${result.mode}${result.databaseName ? `: ${result.databaseName}` : ""})`);
  } catch (error) {
    exitCode = error?.exitStatus ?? 1;
    logError(`[neon-per-pr-ci] FAIL: ${maskDatabaseUrls(error?.message)}`);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
  return exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await runNeonGate());
}
