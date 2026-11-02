#!/usr/bin/env node
/**
 * STACK-10 — Neon per-PR branch CI gate (staging-only; no prod Neon).
 * Used by batch-ci matrix when founder provides NEON_CI_STAGING_DATABASE_URL.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { validateNeonCiDatabaseUrl } from "../../packages/config/dist/neon-ci.js";
import { maskDatabaseUrls, prNumberFromGithubRef, withIsolatedCiDatabase } from "./neon-per-pr-database.mjs";

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

const validation = validateNeonCiDatabaseUrl(process.env);

if (!validation.ok) {
  console.error(`[neon-per-pr-ci] FAIL ${validation.code}: ${validation.message}`);
  process.exit(1);
}

if (validation.mode === "skip") {
  console.log(
    "[neon-per-pr-ci] SKIP: NEON_CI_DATABASE_URL not set (staging Neon secret optional until founder wires CI)."
  );
  process.exit(0);
}

const baseUrl = process.env.NEON_CI_DATABASE_URL ?? process.env.DATABASE_URL;

function stepsAgainst(databaseUrl) {
  const childEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    NEON_CI_DATABASE_URL: databaseUrl,
    RENVANI_DEPLOYMENT_TIER: process.env.RENVANI_DEPLOYMENT_TIER ?? "staging"
  };
  run("corepack", ["pnpm", "--filter", "@fsm/db", "run", "db:check-migrations"], childEnv);
  run("corepack", ["pnpm", "--filter", "@fsm/db", "run", "db:migrate"], childEnv);
  run("corepack", ["pnpm", "--filter", "@fsm/db", "test"], childEnv);
}

console.log(
  "[neon-per-pr-ci] RUN: migration safety + migrate + @fsm/db tests (RLS matrix) against a per-PR database on staging Neon"
);

// postgres.js lives in @fsm/db's dependencies; resolve it from there (repo root has no direct dependency).
const postgres = createRequire(join(repoRoot, "packages/db/package.json"))("postgres");
const sql = postgres(baseUrl, { max: 1, onnotice: () => undefined });

let exitCode = 0;
try {
  const result = await withIsolatedCiDatabase({
    baseUrl,
    sql,
    env: { ...process.env, NEON_CI_PR_NUMBER: process.env.NEON_CI_PR_NUMBER ?? prNumberFromGithubRef(process.env.GITHUB_REF) },
    nowEpochSeconds: Math.floor(Date.now() / 1000),
    runSteps: async (databaseUrl) => stepsAgainst(databaseUrl)
  });
  console.log(`[neon-per-pr-ci] OK (${result.mode}${result.databaseName ? `: ${result.databaseName}` : ""})`);
} catch (error) {
  exitCode = error?.exitStatus ?? 1;
  console.error(`[neon-per-pr-ci] FAIL: ${maskDatabaseUrls(error?.message)}`);
} finally {
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
process.exit(exitCode);
