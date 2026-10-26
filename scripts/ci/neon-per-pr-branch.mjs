#!/usr/bin/env node
/**
 * STACK-10 — Neon per-PR branch CI gate (staging-only; no prod Neon).
 * Used by batch-ci matrix when founder provides NEON_CI_STAGING_DATABASE_URL.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { validateNeonCiDatabaseUrl } from "../../packages/config/dist/neon-ci.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
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

const databaseUrl = process.env.NEON_CI_DATABASE_URL ?? process.env.DATABASE_URL;
const childEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NEON_CI_DATABASE_URL: databaseUrl,
  RENVANI_DEPLOYMENT_TIER: process.env.RENVANI_DEPLOYMENT_TIER ?? "staging"
};

console.log(
  "[neon-per-pr-ci] RUN: migration safety + migrate + @fsm/db tests (RLS matrix) against staging Neon per-PR branch"
);

run("corepack", ["pnpm", "--filter", "@fsm/db", "run", "db:check-migrations"], childEnv);
run("corepack", ["pnpm", "--filter", "@fsm/db", "run", "db:migrate"], childEnv);
run("corepack", ["pnpm", "--filter", "@fsm/db", "test"], childEnv);

console.log("[neon-per-pr-ci] OK");
