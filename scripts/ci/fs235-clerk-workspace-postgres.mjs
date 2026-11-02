#!/usr/bin/env node
/** FS-235: one real-PostgreSQL worker concurrency test on a disposable staging Neon database. */
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateNeonCiDatabaseUrl } from "../../packages/config/dist/neon-ci.js";
import { isApprovedFs235NeonTarget } from "./fs235-neon-target.mjs";
import { assertOnePassingVitestResult, runSilentVitest, runVitestJsonGate } from "./fs235-vitest-diagnostics.mjs";
import { redactDatabaseUrls, withStrictIsolatedCiDatabase } from "./neon-per-pr-database.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const postgres = createRequire(join(repoRoot, "packages/db/package.json"))("postgres");
const baseUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const validation = validateNeonCiDatabaseUrl(process.env);
let parsedUrl = null;
try {
  parsedUrl = baseUrl ? new URL(baseUrl) : null;
} catch {
  // The common gate below reports a generic error without printing the URL.
}

if (
  process.env.GITHUB_EVENT_NAME !== "pull_request" ||
  process.env.FS235_PR_NUMBER !== "411" ||
  process.env.RENVANI_DEPLOYMENT_TIER !== "staging" ||
  !baseUrl ||
  !validation.ok ||
  validation.mode !== "staging" ||
  !parsedUrl ||
  !["postgres:", "postgresql:"].includes(parsedUrl.protocol) ||
  !isApprovedFs235NeonTarget(parsedUrl)
) {
  console.error("[fs235-postgres] invalid or missing approved staging Neon CI target");
  process.exit(1);
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });
  const output = redactDatabaseUrls(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  if (result.status !== 0) {
    console.error(output);
    throw new Error(`${args.at(-1)} failed with exit status ${result.status ?? "unknown"}`);
  }
  return output;
}

async function verifyMigration(sql) {
  const [row] = await sql.unsafe(`
    select
      to_regclass('public.clerk_workspace_intents') is not null as intents,
      to_regclass('public.clerk_workspace_intent_events') is not null as events,
      to_regclass('public.clerk_workspace_intents_clerk_user_idx') is not null as user_idx,
      to_regclass('public.clerk_workspace_intents_attempt_idx') is not null as attempt_idx,
      to_regclass('public.clerk_workspace_intents_clerk_org_idx') is not null as org_idx,
      to_regclass('public.clerk_workspace_intent_events_intent_idx') is not null as event_intent_idx,
      to_regclass('public.clerk_workspace_intent_events_clerk_user_idx') is not null as event_user_idx
  `);
  if (!row || Object.values(row).some((present) => present !== true)) {
    throw new Error("migration 0061 required tables or indexes are missing");
  }
}

function verifyOnePassingTest(outputFile) {
  assertOnePassingVitestResult(outputFile);
  console.log("[fs235-postgres] worker concurrency: 1 executed / 1 passed / 0 skipped");
}

const baseSql = postgres(baseUrl, { max: 1, onnotice: () => undefined });
try {
  const outcome = await withStrictIsolatedCiDatabase({
    baseUrl,
    sql: baseSql,
    env: process.env,
    nowEpochSeconds: Math.floor(Date.now() / 1000),
    runSteps: async (childUrl) => {
      const childEnv = {
        ...process.env,
        DATABASE_URL: childUrl,
        NEON_CI_DATABASE_URL: childUrl,
        RENVANI_DEPLOYMENT_TIER: "staging"
      };
      const outputFile = join(tmpdir(), `renvani-fs235-pg-${randomUUID()}.json`);
      const childSql = postgres(childUrl, { max: 1, onnotice: () => undefined });
      try {
        run("corepack", ["pnpm", "--filter", "@fsm/db", "run", "db:migrate"], childEnv);
        await verifyMigration(childSql);
        runVitestJsonGate({
          outputFile,
          runTest: () => runSilentVitest(
            "corepack",
            ["pnpm", "--filter", "@fsm/worker", "exec", "vitest", "run", "src/processors/clerk-workspace.postgres.integration.test.ts", "--reporter=json", `--outputFile=${outputFile}`],
            childEnv,
            repoRoot
          ),
          verifyResult: verifyOnePassingTest
        });
      } finally {
        await childSql.end({ timeout: 5 });
      }
    }
  });
  if (outcome.mode !== "isolated") {
    throw new Error("strict worker test did not use an isolated database");
  }
  console.log("[fs235-postgres] isolated database created, tested, and dropped");
} catch (error) {
  console.error(`[fs235-postgres] FAIL: ${redactDatabaseUrls(error?.message)}`);
  process.exitCode = 1;
} finally {
  await baseSql.end({ timeout: 5 }).catch(() => {
    console.error("[fs235-postgres] FAIL: base database connection cleanup failed");
    process.exitCode = 1;
  });
}
