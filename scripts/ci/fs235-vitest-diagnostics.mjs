import { existsSync, readFileSync, rmSync } from "node:fs";

import { redactDatabaseUrls } from "./neon-per-pr-database.mjs";

const MAX_FAILURES = 3;
const MAX_FAILURE_MESSAGE_LENGTH = 4_000;

function cleanLogText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, MAX_FAILURE_MESSAGE_LENGTH);
}

function failedAssertions(result) {
  const failures = [];
  for (const suite of Array.isArray(result?.testResults) ? result.testResults : []) {
    for (const assertion of Array.isArray(suite?.assertionResults) ? suite.assertionResults : []) {
      if (assertion?.status !== "failed") continue;
      const title = cleanLogText(assertion.fullName || assertion.title || "unnamed test");
      const messages = Array.isArray(assertion.failureMessages)
        ? assertion.failureMessages.map(cleanLogText).filter(Boolean).join("\n")
        : "";
      failures.push(`${title}: ${messages || "failed without a reported message"}`);
      if (failures.length === MAX_FAILURES) return failures;
    }
  }
  return failures;
}

/** Build a bounded failure summary from Vitest's JSON reporter output without exposing database URLs. */
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
    executed: result?.numTotalTests,
    passed: result?.numPassedTests,
    failed: result?.numFailedTests,
    skipped: result?.numPendingTests,
    todo: result?.numTodoTests
  };
  const failures = failedAssertions(result);
  const details = failures.length > 0 ? `\n${failures.join("\n")}` : "";
  return redactDatabaseUrls(`Vitest result ${JSON.stringify(counts)}${details}`);
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
