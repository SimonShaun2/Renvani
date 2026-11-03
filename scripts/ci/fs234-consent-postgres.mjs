#!/usr/bin/env node
/** FS-234: strict, disposable PostgreSQL acceptance for migration 0062 and consent authority. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateNeonCiDatabaseUrl } from "../../packages/config/dist/neon-ci.js";
import { isApprovedNeonTesterTarget } from "./approved-neon-tester-target.mjs";
import { prNumberFromGithubRef, redactDatabaseUrls, withStrictIsolatedCiDatabase } from "./neon-per-pr-database.mjs";
import { runSilentVitest, runVitestJsonGate } from "./strict-vitest-json.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const postgres = createRequire(join(root, "packages/db/package.json"))("postgres");
const baseUrl = process.env.NEON_CI_DATABASE_URL?.trim();
let target;
try { target = baseUrl ? new URL(baseUrl) : null; } catch { /* Reject below without printing it. */ }
const validation = validateNeonCiDatabaseUrl(process.env);
if (process.version !== "v22.16.0" ||
    process.env.GITHUB_EVENT_NAME !== "pull_request" ||
    process.env.GITHUB_HEAD_REF !== "codex/consent-ledger-contract" ||
    process.env.GITHUB_BASE_REF !== "dev" ||
    process.env.FS234_PR_NUMBER !== "430" ||
    prNumberFromGithubRef(process.env.GITHUB_REF) !== "430" ||
    process.env.RENVANI_DEPLOYMENT_TIER !== "staging" ||
    !/^[0-9a-f]{40}$/.test(process.env.FS234_HEAD_SHA ?? "") ||
    !baseUrl || !validation.ok || validation.mode !== "staging" ||
    !target || !["postgres:", "postgresql:"].includes(target.protocol) ||
    !isApprovedNeonTesterTarget(target)) {
  console.error("[fs234-postgres] approved PR, runtime, or isolated Neon target missing");
  process.exit(1);
}

const journal = JSON.parse(readFileSync(join(root, "packages/db/migrations/meta/_journal.json"), "utf8"));
const prior = journal.entries.find((entry) => entry.tag === "0061_fs235_clerk_workspace_intent");
const current = journal.entries.find((entry) => entry.tag === "0062_fs234_outbound_consent_ledger");
assert.equal(prior?.idx, 61);
assert.equal(current?.idx, 62);
assert.ok(current.when > prior.when);

function migrate(env) {
  const result = spawnSync("corepack", ["pnpm", "--filter", "@fsm/db", "run", "db:migrate"],
    { cwd: root, env, stdio: "ignore", shell: false });
  if (result.status !== 0) throw new Error(`migration failed with exit status ${Number.isSafeInteger(result.status) ? result.status : "unknown"}`);
}

async function rejected(work, code) {
  try { await work(); } catch (error) {
    if (code) assert.equal(error.code, code);
    return;
  }
  throw new Error(`expected PostgreSQL rejection ${code ?? ""}`);
}

async function tenant(sql, companyId, work) {
  return sql.begin(async (tx) => {
    await tx`select set_config('app.current_company_id', ${companyId}, true)`;
    return work(tx);
  });
}

async function inspectAndExercise(sql) {
  const [role] = await sql`select rolbypassrls, rolsuper from pg_roles where rolname = current_user`;
  if (!role || role.rolbypassrls || role.rolsuper) {
    throw new Error("CI application role must be NOBYPASSRLS and non-superuser");
  }
  const tables = ["outbound_consent_capture_receipts", "outbound_consent_events", "outbound_consent_states"];
  for (const name of tables) {
    const [row] = await sql`
      select c.relrowsecurity, c.relforcerowsecurity,
        (select count(*)::int from pg_policies p where p.tablename = ${name}) as policies
      from pg_class c where c.oid = to_regclass(${`public.${name}`})`;
    assert.ok(row?.relrowsecurity && row.relforcerowsecurity && row.policies >= 2,
      `missing forced tenant policy on ${name}`);
    const [fk] = await sql`
      select confdeltype from pg_constraint where conname = ${`${name}_company_id_companies_id_fk`}`;
    assert.equal(fk?.confdeltype, "a", `consent company FK must be NO ACTION on ${name}`);
  }
  const triggers = ["outbound_consent_receipts_append_only_trg", "outbound_consent_events_append_only_trg", "outbound_consent_state_no_delete_trg"];
  for (const name of triggers) {
    const [trigger] = await sql`select tgenabled from pg_trigger where tgname = ${name} and not tgisinternal`;
    assert.equal(trigger?.tgenabled, "O", `missing evidence trigger ${name}`);
  }

  const a = randomUUID();
  const b = randomUUID();
  const ra = randomUUID();
  const rb = randomUUID();
  const sa = randomUUID();
  const ea = randomUUID();
  const eb = randomUUID();
  await sql`insert into companies (id, name, slug) values
    (${a}, 'FS234 CI A', ${`fs234-ci-${a}`}), (${b}, 'FS234 CI B', ${`fs234-ci-${b}`})`;
  for (const [companyId, receiptId, eventId] of [[a, ra, ea], [b, rb, eb]]) {
    await tenant(sql, companyId, async (tx) => {
      await tx`
      insert into outbound_consent_capture_receipts
      (id, company_id, subject_type, subject_id, channel, purpose, contact, decision,
       explicit_choice, statement_version, source_record_id, source_surface, actor_type,
       idempotency_key, payload_fingerprint)
      values (${receiptId}, ${companyId}, 'customer', ${sa}, 'email', 'marketing',
        'fs234-ci@example.test', 'revoke', true, 'ci-v1', ${sa}, 'operator', 'user',
        ${`fs234-ci-${companyId}`}, ${"a".repeat(64)})`;
      await tx`
        insert into outbound_consent_events
        (id, company_id, subject_type, subject_id, channel, purpose, contact,
         decision, version, source_kind, source_record_id, statement_version,
         actor_type, evidence_ref, idempotency_key, decision_fingerprint, current_state)
        values (${eventId}, ${companyId}, 'customer', ${sa}, 'email', 'marketing',
          'fs234-ci@example.test', 'revoke', 1, 'operator_revoke', ${sa}, 'ci-v1',
          'user', ${receiptId}, ${`fs234-event-${companyId}`}, ${"b".repeat(64)}, 'revoked')`;
      await tx`
        insert into outbound_consent_states
        (company_id, subject_type, subject_id, channel, purpose, contact, state,
         version, source_kind, source_record_id, statement_version, last_event_id)
        values (${companyId}, 'customer', ${sa}, 'email', 'marketing',
          'fs234-ci@example.test', 'revoked', 1, 'operator_revoke', ${sa}, 'ci-v1', ${eventId})`;
    });
  }
  for (const [table, expectedA, expectedB] of [
    ["outbound_consent_capture_receipts", ra, rb],
    ["outbound_consent_events", ea, eb],
    ["outbound_consent_states", null, null]
  ]) {
    const absent = await sql.unsafe(`select id from ${table}`);
    assert.equal(absent.length, 0, `no-session read leaked ${table}`);
    const visibleA = await tenant(sql, a, (tx) => tx.unsafe(`select company_id, id from ${table}`));
    const visibleB = await tenant(sql, b, (tx) => tx.unsafe(`select company_id, id from ${table}`));
    assert.equal(visibleA.length, 1, `wrong tenant A visibility on ${table}`);
    assert.equal(visibleB.length, 1, `wrong tenant B visibility on ${table}`);
    assert.equal(visibleA[0].company_id, a);
    assert.equal(visibleB[0].company_id, b);
    if (expectedA) assert.equal(visibleA[0].id, expectedA);
    if (expectedB) assert.equal(visibleB[0].id, expectedB);
  }
  await rejected(() => sql`insert into outbound_consent_capture_receipts
    (company_id, subject_type, subject_id, channel, purpose, contact, decision,
     explicit_choice, statement_version, source_record_id, source_surface, actor_type,
     idempotency_key, payload_fingerprint)
    values (${a}, 'customer', ${sa}, 'email', 'marketing', 'fs234-ci@example.test',
      'revoke', true, 'ci-v1', ${sa}, 'operator', 'user', 'no-session', ${"a".repeat(64)})`, "42501");
  await rejected(() => tenant(sql, a, (tx) => tx`update outbound_consent_capture_receipts
    set statement_version = 'forged' where id = ${ra}`), "P0001");
  await rejected(() => tenant(sql, a, (tx) => tx`delete from outbound_consent_capture_receipts
    where id = ${ra}`), "P0001");
  await rejected(() => tenant(sql, a, (tx) => tx`update outbound_consent_events
    set statement_version = 'forged' where id = ${ea}`), "P0001");
  await rejected(() => tenant(sql, a, (tx) => tx`delete from outbound_consent_events
    where id = ${ea}`), "P0001");
  await rejected(() => tenant(sql, a, (tx) => tx`delete from outbound_consent_states
    where company_id = ${a}`), "P0001");
  await rejected(() => sql`delete from companies where id = ${a}`, "23503");
  const rollbackId = randomUUID();
  await rejected(() => tenant(sql, a, async (tx) => {
    await tx`insert into outbound_consent_capture_receipts
      (id, company_id, subject_type, subject_id, channel, purpose, contact, decision,
       explicit_choice, statement_version, source_record_id, source_surface, actor_type,
       idempotency_key, payload_fingerprint)
      values (${rollbackId}, ${a}, 'customer', ${sa}, 'email', 'marketing',
        'fs234-ci@example.test', 'revoke', true, 'ci-v1', ${sa}, 'operator', 'user',
        'rollback', ${"a".repeat(64)})`;
    throw Object.assign(new Error("intentional transaction rollback"), { code: "FS234_ROLLBACK" });
  }), "FS234_ROLLBACK");
  const afterRollback = await tenant(sql, a, (tx) => tx`select id from outbound_consent_capture_receipts where id = ${rollbackId}`);
  assert.equal(afterRollback.length, 0, "consent insert survived transaction rollback");
  console.log("[fs234-postgres] migration order, forced RLS, tenant denial, evidence immutability, FK and rollback probes passed");
}

function verifySix(outputFile) {
  const result = JSON.parse(readFileSync(outputFile, "utf8"));
  if (result.numTotalTests !== 6 || result.numPassedTests !== 6 ||
      result.numFailedTests !== 0 || result.numPendingTests !== 0 || result.numTodoTests !== 0) {
    throw new Error("required service PostgreSQL result was not 6 executed / 6 passed / 0 skipped");
  }
  console.log("[fs234-postgres] service acceptance: 6 executed / 6 passed / 0 skipped");
}

const baseSql = postgres(baseUrl, { max: 1, onnotice: () => undefined });
try {
  const outcome = await withStrictIsolatedCiDatabase({
    baseUrl, sql: baseSql, env: process.env, prNumber: "430",
    nowEpochSeconds: Math.floor(Date.now() / 1000),
    runSteps: async (childUrl) => {
      const env = {
        ...process.env,
        DATABASE_URL: childUrl,
        NEON_CI_DATABASE_URL: childUrl,
        FS234_ISOLATED_DATABASE: "1"
      };
      const childSql = postgres(childUrl, { max: 4, onnotice: () => undefined });
      const outputFile = join(tmpdir(), `renvani-fs234-pg-${randomUUID()}.json`);
      try {
        migrate(env);
        await inspectAndExercise(childSql);
        runVitestJsonGate({
          outputFile,
          runTest: () => runSilentVitest("corepack", ["pnpm", "--filter", "@fsm/api", "exec", "vitest", "run",
            "src/services/outbound-consent.postgres.integration.test.ts", "--reporter=json", `--outputFile=${outputFile}`], env, root),
          verifyResult: verifySix
        });
      } finally {
        await childSql.end({ timeout: 5 });
      }
    }
  });
  assert.equal(outcome.mode, "isolated");
  console.log("[fs234-postgres] isolated database created, tested, and dropped");
} catch (error) {
  console.error(`[fs234-postgres] FAIL: ${redactDatabaseUrls(error?.message)}`);
  process.exitCode = 1;
} finally {
  await baseSql.end({ timeout: 5 }).catch(() => {
    console.error("[fs234-postgres] FAIL: base connection cleanup failed");
    process.exitCode = 1;
  });
}
