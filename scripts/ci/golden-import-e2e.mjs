#!/usr/bin/env node
/**
 * FS-152 — Golden import e2e (QuickBooks Desktop + Service Fusion) on Neon CI.
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
  console.error(`[golden-import-e2e] FAIL ${validation.code}: ${validation.message}`);
  process.exit(1);
}

if (validation.mode === "skip") {
  console.log(
    "[golden-import-e2e] SKIP: NEON_CI_DATABASE_URL not set (golden import e2e runs on staging Neon only)."
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

console.log("[golden-import-e2e] RUN: QuickBooks Desktop + Service Fusion bundle e2e on Neon");

run("corepack", ["pnpm", "--filter", "@fsm/import-normalize", "build"], childEnv);
run("corepack", ["pnpm", "--filter", "@fsm/types", "build"], childEnv);
run("corepack", ["pnpm", "--filter", "@fsm/import-engine", "build"], childEnv);
run("corepack", ["pnpm", "--filter", "@fsm/config", "build"], childEnv);
run("corepack", ["pnpm", "--filter", "@fsm/db", "build"], childEnv);
run(
  "corepack",
  [
    "pnpm",
    "--filter",
    "@fsm/db",
    "exec",
    "vitest",
    "run",
    "src/golden-import-e2e.integration.test.ts"
  ],
  childEnv
);

console.log("[golden-import-e2e] OK");
