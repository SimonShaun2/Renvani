import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";

import { redactDatabaseUrls } from "./neon-per-pr-database.mjs";

const MAX_FAILURES = 3;
const MAX_SUITES_SCANNED = 10;
const MAX_ASSERTIONS_SCANNED_PER_SUITE = 50;
const MAX_MESSAGES_SCANNED_PER_ASSERTION = 3;
const MAX_MESSAGE_CHARS_SCANNED = 2_000;
const MAX_SUMMARY_LENGTH = 2_000;
const KNOWN_ASSERTION_TITLE = "authorizes exactly one provider create across concurrent workers";
const KNOWN_TEST_FILE = "clerk-workspace.postgres.integration.test.ts";

/** Vitest writes a JSON result file. Its raw streams can contain credentials or customer data. */
export function runSilentVitest(command, args, env, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "ignore",
    shell: false
  });
  if (result.status !== 0) {
    throw new Error(`Vitest exited with status ${safeCount(result.status)}`);
  }
}

/** Check the required gate without ever echoing untrusted reporter fields in an exception. */
export function assertOnePassingVitestResult(outputFile) {
  if (!existsSync(outputFile)) {
    throw new Error("Vitest JSON result missing");
  }
  let result;
  try {
    result = JSON.parse(readFileSync(outputFile, "utf8"));
  } catch {
    throw new Error("Vitest JSON result invalid");
  }
  if (
    result?.numTotalTests !== 1 ||
    result?.numPassedTests !== 1 ||
    result?.numFailedTests !== 0 ||
    result?.numPendingTests !== 0 ||
    result?.numTodoTests !== 0
  ) {
    throw new Error("required worker concurrency result was not 1/1/0");
  }
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : "unknown";
}

function assertionCode(value) {
  const title = typeof value === "string" ? value : "";
  return title === KNOWN_ASSERTION_TITLE || title.endsWith(` ${KNOWN_ASSERTION_TITLE}`)
    ? "fs235_concurrent_claim"
    : "unknown";
}

function messageMetadata(messages) {
  const reported = Array.isArray(messages) ? messages : [];
  const scanned = reported
    .slice(0, MAX_MESSAGES_SCANNED_PER_ASSERTION)
    .filter((message) => typeof message === "string")
    .map((message) => message.slice(0, MAX_MESSAGE_CHARS_SCANNED))
    .join("\n");

  const type = /\bAssertionError\b/.test(scanned)
    ? "AssertionError"
    : /\bPostgresError\b/.test(scanned)
      ? "PostgresError"
      : /\bTypeError\b/.test(scanned)
        ? "TypeError"
        : /\bError\b/.test(scanned)
          ? "Error"
          : "unknown";
  const kind = /\b(?:timed? ?out|timeout)\b/i.test(scanned)
    ? "timeout"
    : /\b(?:ECONNREFUSED|connection refused)\b/i.test(scanned)
      ? "connection_refused"
      : /\btoHaveLength\b|\bAssertionError\b/.test(scanned)
        ? "assertion_failure"
        : type === "PostgresError"
          ? "postgres_error"
          : "unknown";
  const locationMatch = new RegExp(`(?:^|[\\\\/])(${KNOWN_TEST_FILE.replaceAll(".", "\\.")}):(\\d{1,6}):(\\d{1,6})\\b`, "m").exec(scanned);
  const location = locationMatch
    ? `${KNOWN_TEST_FILE}:${locationMatch[2]}:${locationMatch[3]}`
    : "unknown";
  const phase = /\bFS235_PG_PHASE_(db_import|processor_import|intent_insert|claims|archive)\b/.exec(scanned)?.[1] ?? "unknown";

  return {
    type,
    kind,
    location,
    phase,
    messages: Math.min(reported.length, MAX_MESSAGES_SCANNED_PER_ASSERTION),
    messagesOmitted: reported.length > MAX_MESSAGES_SCANNED_PER_ASSERTION
  };
}

function failedAssertions(result) {
  const failures = [];
  const suites = Array.isArray(result?.testResults)
    ? result.testResults.slice(0, MAX_SUITES_SCANNED)
    : [];
  for (const suite of suites) {
    const assertions = Array.isArray(suite?.assertionResults)
      ? suite.assertionResults.slice(0, MAX_ASSERTIONS_SCANNED_PER_SUITE)
      : [];
    for (const assertion of assertions) {
      if (assertion?.status !== "failed") continue;
      const metadata = messageMetadata(assertion.failureMessages);
      failures.push(
        `failure assertion=${assertionCode(assertion.fullName || assertion.title)}`
        + ` type=${metadata.type} kind=${metadata.kind} location=${metadata.location} phase=${metadata.phase}`
        + ` messages=${metadata.messages} messages_omitted=${metadata.messagesOmitted}`
      );
      if (failures.length === MAX_FAILURES) return failures;
    }
  }
  return failures;
}

/** Build a bounded failure summary without emitting arbitrary Vitest reporter text. */
export function vitestFailureSummary(outputFile) {
  if (!existsSync(outputFile)) {
    return "Vitest failed; JSON result was not produced";
  }

  let result;
  try {
    result = JSON.parse(readFileSync(outputFile, "utf8"));
  } catch {
    return "Vitest failed; JSON result was invalid";
  }

  const counts = {
    executed: safeCount(result?.numTotalTests),
    passed: safeCount(result?.numPassedTests),
    failed: safeCount(result?.numFailedTests),
    skipped: safeCount(result?.numPendingTests),
    todo: safeCount(result?.numTodoTests)
  };
  const failures = failedAssertions(result);
  const details = failures.length > 0 ? `\n${failures.join("\n")}` : "";
  return redactDatabaseUrls(`Vitest result ${JSON.stringify(counts)}${details}`)
    .slice(0, MAX_SUMMARY_LENGTH);
}

/** Run and verify the JSON-reported Vitest gate, logging diagnostics before deleting its temporary result. */
export function runVitestJsonGate({ outputFile, runTest, verifyResult, log = console.error }) {
  try {
    runTest();
    verifyResult(outputFile);
  } catch (error) {
    log(`[fs235-postgres] ${vitestFailureSummary(outputFile)}`);
    throw error;
  } finally {
    rmSync(outputFile, { force: true });
  }
}
