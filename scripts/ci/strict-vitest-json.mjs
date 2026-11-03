import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";

/** Do not stream test output: reporters may include credentials or customer data. */
export function runSilentVitest(command, args, env, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: "ignore", shell: false });
  if (result.status !== 0) {
    const status = Number.isSafeInteger(result.status) && result.status >= 0 ? result.status : "unknown";
    throw new Error(`Vitest exited with status ${status}`);
  }
}

function counts(outputFile) {
  if (!existsSync(outputFile)) throw new Error("Vitest JSON result missing");
  try {
    const result = JSON.parse(readFileSync(outputFile, "utf8"));
    return {
      total: result?.numTotalTests,
      passed: result?.numPassedTests,
      failed: result?.numFailedTests,
      skipped: result?.numPendingTests,
      todo: result?.numTodoTests
    };
  } catch {
    throw new Error("Vitest JSON result invalid");
  }
}

/** A skipped database test cannot pass the real-PostgreSQL gate. */
export function assertOnePassingVitestResult(outputFile) {
  const result = counts(outputFile);
  if (result.total !== 1 || result.passed !== 1 || result.failed !== 0 || result.skipped !== 0 || result.todo !== 0) {
    throw new Error("required PostgreSQL result was not 1 executed / 1 passed / 0 skipped");
  }
}

export function runVitestJsonGate({ outputFile, runTest, verifyResult, log = console.error }) {
  try {
    runTest();
    verifyResult(outputFile);
  } catch (error) {
    try {
      const result = counts(outputFile);
      const safe = Object.fromEntries(Object.entries(result).map(([key, value]) => [key, Number.isSafeInteger(value) && value >= 0 ? value : "unknown"]));
      log(`[strict-postgres] Vitest counts ${JSON.stringify(safe)}`);
    } catch {
      log("[strict-postgres] Vitest JSON counts unavailable");
    }
    throw error;
  } finally {
    rmSync(outputFile, { force: true });
  }
}
