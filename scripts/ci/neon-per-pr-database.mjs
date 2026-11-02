/**
 * Per-PR database isolation for the Neon CI gate (staging-only; no prod Neon).
 * Each CI run gets its own throwaway database `ci_pr_<id>_<attempt>_<epochSeconds>` on the staging
 * server, so concurrent PR runs never share tables. Pure helpers are exported for unit tests;
 * the SQL client is injected (`sql.unsafe(text)` returning rows), so no live DB is needed to test.
 */

export const CI_DB_PREFIX = "ci_pr_";
export const STALE_CI_DB_MAX_AGE_SECONDS = 6 * 60 * 60;
const PG_IDENTIFIER_MAX = 63;

/** Lowercase, [a-z0-9_] only, capped to Postgres' 63-byte identifier limit; epoch suffix is always kept. */
export function buildCiDatabaseName({ prNumber, runId, runAttempt, nowEpochSeconds }) {
  const clean = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  const id = clean(prNumber) || clean(runId) || "local";
  const attempt = clean(runAttempt) || "1";
  const epoch = String(Math.floor(Number(nowEpochSeconds)));
  if (!/^\d+$/.test(epoch)) {
    throw new Error("nowEpochSeconds must be a number");
  }
  const suffix = `_${epoch}`;
  const head = `${CI_DB_PREFIX}${id}_${attempt}`.slice(0, PG_IDENTIFIER_MAX - suffix.length).replace(/_+$/, "");
  return `${head}${suffix}`;
}

/** Epoch seconds encoded at the end of a ci_pr_* name, or null when the name isn't ours. */
export function parseCiDatabaseEpoch(name) {
  if (typeof name !== "string" || !name.startsWith(CI_DB_PREFIX)) {
    return null;
  }
  const match = /_(\d{9,11})$/.exec(name);
  return match ? Number(match[1]) : null;
}

export function isSafeCiDatabaseName(name) {
  return typeof name === "string" && name.length <= PG_IDENTIFIER_MAX && /^ci_pr_[a-z0-9_]+$/.test(name);
}

/** Child URL with only the database path swapped (URL class: credentials with special characters stay encoded). */
export function buildChildDatabaseUrl(baseUrl, databaseName) {
  if (!isSafeCiDatabaseName(databaseName)) {
    throw new Error("refusing unsafe CI database name");
  }
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

/** Replaces any credentials in postgres URLs inside text (for log lines and error messages). */
export function maskDatabaseUrls(text) {
  return String(text ?? "").replace(/(postgres(?:ql)?:\/\/)[^@\s/]+@/gi, "$1***@");
}

function quoteIdent(name) {
  if (!isSafeCiDatabaseName(name)) {
    throw new Error("refusing unsafe CI database name");
  }
  return `"${name}"`;
}

/** true when the connected role may CREATE DATABASE (rolcreatedb or superuser). */
export async function canCreateDatabase(sql) {
  const rows = await sql.unsafe(
    "select rolcreatedb, rolsuper from pg_roles where rolname = current_user"
  );
  const row = rows[0];
  return Boolean(row && (row.rolcreatedb || row.rolsuper));
}

/** Best effort: drop ci_pr_* databases whose encoded epoch is older than maxAge. Never throws. */
export async function dropStaleCiDatabases(sql, { nowEpochSeconds, maxAgeSeconds = STALE_CI_DB_MAX_AGE_SECONDS, log = console.log }) {
  const dropped = [];
  let rows = [];
  try {
    rows = await sql.unsafe("select datname from pg_database where datname like 'ci\\_pr\\_%'");
  } catch (error) {
    log(`[neon-per-pr-ci] stale cleanup skipped: ${maskDatabaseUrls(error?.message)}`);
    return dropped;
  }
  for (const { datname } of rows) {
    const epoch = parseCiDatabaseEpoch(datname);
    if (epoch === null || !isSafeCiDatabaseName(datname) || nowEpochSeconds - epoch <= maxAgeSeconds) {
      continue;
    }
    try {
      await sql.unsafe(`drop database if exists ${quoteIdent(datname)} with (force)`);
      dropped.push(datname);
    } catch (error) {
      log(`[neon-per-pr-ci] stale cleanup could not drop ${datname}: ${maskDatabaseUrls(error?.message)}`);
    }
  }
  if (dropped.length > 0) {
    log(`[neon-per-pr-ci] dropped ${dropped.length} stale CI database(s): ${dropped.join(", ")}`);
  }
  return dropped;
}

function isPermissionError(error) {
  return error?.code === "42501" || /permission denied/i.test(String(error?.message ?? ""));
}

/**
 * Runs `runSteps(databaseUrl)` against an isolated per-run database, always dropping it afterwards.
 * Falls back to `runSteps(baseUrl)` (the shared staging DB, previous behavior) when the role
 * cannot create databases. Returns { mode: "isolated" | "shared", databaseName? }.
 */
export async function withIsolatedCiDatabase({ baseUrl, sql, env, nowEpochSeconds, runSteps, log = console.log }) {
  await dropStaleCiDatabases(sql, { nowEpochSeconds, log });

  let allowed = false;
  try {
    allowed = await canCreateDatabase(sql);
  } catch (error) {
    log(`[neon-per-pr-ci] could not read role privileges: ${maskDatabaseUrls(error?.message)}`);
  }

  const fallback = async (reason) => {
    log(`[neon-per-pr-ci] FALLBACK: ${reason}; running against the shared staging database (no per-PR isolation).`);
    await runSteps(baseUrl);
    return { mode: "shared" };
  };

  if (!allowed) {
    return fallback("role lacks CREATEDB");
  }

  const databaseName = buildCiDatabaseName({
    prNumber: env.NEON_CI_PR_NUMBER ?? env.PR_NUMBER,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    nowEpochSeconds
  });

  try {
    await sql.unsafe(`create database ${quoteIdent(databaseName)}`);
  } catch (error) {
    if (isPermissionError(error)) {
      return fallback("CREATE DATABASE permission denied");
    }
    throw new Error(`could not create CI database ${databaseName}: ${maskDatabaseUrls(error?.message)}`);
  }

  log(`[neon-per-pr-ci] created isolated CI database ${databaseName}`);
  try {
    await runSteps(buildChildDatabaseUrl(baseUrl, databaseName));
    return { mode: "isolated", databaseName };
  } finally {
    try {
      await sql.unsafe(`drop database if exists ${quoteIdent(databaseName)} with (force)`);
      log(`[neon-per-pr-ci] dropped CI database ${databaseName}`);
    } catch (error) {
      log(`[neon-per-pr-ci] WARN could not drop ${databaseName} (stale cleanup will retry): ${maskDatabaseUrls(error?.message)}`);
    }
  }
}

/** PR number from GITHUB_REF (refs/pull/<n>/merge) when present. */
export function prNumberFromGithubRef(ref) {
  const match = /^refs\/pull\/(\d+)\//.exec(String(ref ?? ""));
  return match ? match[1] : undefined;
}
