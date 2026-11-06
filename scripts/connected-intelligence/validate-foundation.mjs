import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Local, offline-after-install validation. Does not dispatch CI, use a provider or modify source/credentials. */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const full = process.argv.includes("--full");
const outArg = process.argv.find((arg) => arg.startsWith("--out="));
const output = outArg ? resolve(outArg.slice(6)) : mkdtempSync(join(tmpdir(), "renvani-rci-"));
if (output === root) throw new Error("Use a separate output directory");
mkdirSync(output, { recursive: true });
const commands = [];
function run(label, args) {
  const result = spawnSync("pnpm", args, { cwd: root, encoding: "utf8", timeout: 180000, maxBuffer: 12 * 1024 * 1024,
    env: { ...process.env, RESEND_API_KEY: "", NO_COLOR: "1" } });
  const logPath = join(output, `${label}.log`);
  writeFileSync(logPath, `${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error?.message ?? ""}`);
  commands.push({ label, command: ["pnpm", ...args], exitCode: result.status, signal: result.signal, log: `${label}.log` });
  if (result.status !== 0) throw new Error(`${label} did not pass. See ${logPath}`);
}
function git(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 10000 });
  if (result.status !== 0) throw new Error("Unable to record repository state");
  return result.stdout.trim();
}
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", "node_modules", "dist", ".next", ".turbo", "coverage"].includes(entry.name)) return [];
    const fullPath = join(path, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}
function auditIsolation() {
  const allowed = ["packages/types/src/connected-intelligence/", "packages/types/test-fixtures/", "apps/api/src/services/connected-intelligence/"];
  const violations = [];
  for (const file of [...walk(join(root, "apps")), ...walk(join(root, "packages"))]) {
    const name = relative(root, file).replaceAll("\\", "/");
    if (!/\.(?:tsx?|mjs|js)$/u.test(name) || allowed.some((prefix) => name.startsWith(prefix)) || name.includes(".test.")) continue;
    if (/(?:from\s*|import\s*\()\s*["'][^"']*connected-intelligence/u.test(readFileSync(file, "utf8"))) violations.push(name);
  }
  const pkg = JSON.parse(readFileSync(join(root, "packages/types/package.json"), "utf8"));
  if (JSON.stringify(pkg.exports).includes("connected-intelligence")) violations.push("packages/types/package.json exports");
  if (violations.length) throw new Error(`Unexpected production adoption: ${violations.join(", ")}`);
  const register = JSON.parse(readFileSync(join(root, "docs/connected-intelligence/foundation/source-register.json"), "utf8"));
  for (const item of register.sources) {
    const file = join(root, item.path);
    if (!existsSync(file)) throw new Error(`Missing source: ${item.path}`);
    const source = readFileSync(file, "utf8");
    for (const symbol of item.symbols) if (!source.includes(symbol)) throw new Error(`Missing source symbol: ${item.path}#${symbol}`);
  }
  return { productionImports: 0, publicExports: 0, sourcePathsVerified: register.sources.length, baseline: register.sourceBaseline };
}
function digest() {
  const directories = ["packages/types/src/connected-intelligence", "apps/api/src/services/connected-intelligence", "scripts/connected-intelligence"];
  const files = [...directories.flatMap((path) => walk(join(root, path))), join(root, "packages/types/test-fixtures/connected-intelligence.ts"),
    join(root, "packages/types/tsconfig.connected-intelligence.json"), join(root, "apps/api/tsconfig.connected-intelligence.json")].sort();
  const hashes = files.map((file) => ({ path: relative(root, file).replaceAll("\\", "/"), sha256: createHash("sha256").update(readFileSync(file)).digest("hex") }));
  return { sha256: createHash("sha256").update(JSON.stringify(hashes)).digest("hex"), files: hashes };
}
const report = { recordedAt: new Date().toISOString(), scope: "Document 1 H01–H16 isolated foundation", runtimeEnabled: false,
  node: process.version, head: git(["rev-parse", "HEAD"]), workingTree: git(["status", "--porcelain"]),
  source: digest(), commands, success: false, coverage: [], suites: [], isolation: null,
  notExecuted: ["authenticated API/database/RLS", "live model/provider", "full web/API application suite", "independent Peer/QA/Security/Design", "approved CI", "production deployment"] };
try {
  if (process.version !== "v22.16.0") throw new Error("Use the repository-pinned Node 22.16.0; do not silently test a different runtime");
  report.isolation = auditIsolation();
  run("build-normalize", ["--filter", "@fsm/import-normalize", "build"]);
  run("types-strict", ["--filter", "@fsm/types", "exec", "tsc", "-p", "tsconfig.connected-intelligence.json"]);
  run("math-strict", ["--filter", "@fsm/api", "exec", "tsc", "-p", "tsconfig.connected-intelligence.json"]);
  run("types-build", ["--filter", "@fsm/types", "build"]);
  run("scoped-lint", ["exec", "eslint", "packages/types/src/connected-intelligence", "packages/types/test-fixtures/connected-intelligence.ts", "apps/api/src/services/connected-intelligence", "scripts/connected-intelligence"]);
  const typesReport = join(output, "foundation-types.json");
  const mathReport = join(output, "foundation-math.json");
  run("foundation-types", ["--filter", "@fsm/types", "exec", "vitest", "run", "src/connected-intelligence", "--reporter=json", `--outputFile=${typesReport}`]);
  run("foundation-math", ["--filter", "@fsm/api", "exec", "vitest", "run", "src/services/connected-intelligence/foundation-math.test.ts", "--reporter=json", `--outputFile=${mathReport}`]);
  const reports = [typesReport, mathReport].map((file) => JSON.parse(readFileSync(file, "utf8")));
  const assertions = reports.flatMap((r) => r.testResults.flatMap((s) => s.assertionResults));
  report.coverage = Array.from({ length: 24 }, (_, index) => {
    const id = `CI-A${String(index + 1).padStart(2, "0")}`;
    const tests = assertions.filter((test) => test.fullName.includes(id));
    return { id, foundationStatus: tests.length && tests.every((test) => test.status === "passed") ? "passed" : "uncovered_or_failed",
      tests: tests.map((test) => test.fullName), runtimeAcceptance: "not_executed" };
  });
  if (report.coverage.some((caseResult) => caseResult.foundationStatus !== "passed")) throw new Error("Acceptance catalog has an uncovered/failed offline case");
  if (full) {
    run("build-import-engine", ["--filter", "@fsm/import-engine", "build"]);
    run("build-config", ["--filter", "@fsm/config", "build"]);
    const file = join(output, "full-types.json");
    run("full-types", ["--filter", "@fsm/types", "exec", "vitest", "run", "--reporter=json", `--outputFile=${file}`]);
    reports.push(JSON.parse(readFileSync(file, "utf8")));
  }
  report.suites = reports.map((r, index) => ({ scope: index === 0 ? "foundation-types" : index === 1 ? "foundation-math" : "full-types-includes-foundation",
    success: r.success, total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, pending: r.numPendingTests, todo: r.numTodoTests }));
  if (report.suites.some((suite) => !suite.success || suite.failed || suite.pending)) throw new Error("Reported suite is incomplete");
  report.success = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : "Unknown validation failure";
  process.exitCode = 1;
} finally {
  writeFileSync(join(output, "validation.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ success: report.success, output, suites: report.suites, coveredOfflineScenarios: report.coverage.filter((c) => c.foundationStatus === "passed").length,
    isolation: report.isolation, sourceDigest: report.source.sha256, error: report.error ?? null }, null, 2));
}
