/** FS-76 policy v1. Pinned to this repository revision; no remote scanner or mutable ruleset. */
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SECRET_SCAN_POLICY_VERSION = "fs76-v1";

const rules = Object.freeze({
  provider_secret: /\bsk_(?:test|live)_[A-Za-z0-9]{20,}\b/u,
  stripe_webhook: /\bwhsec_[A-Za-z0-9]{24,}\b/u,
  openai_secret: /\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}\b/u,
  github_token: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/u,
  private_key: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{80,}-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  synthetic_canary: /FS76_SCANNER_CANARY_[A-Z0-9]{16,}/u
});

const requiredBuildRoots = Object.freeze([
  "apps/api/dist", "apps/worker/dist", "apps/webhook/dist",
  "apps/web/.next/server", "apps/web/.next/static"
]);

/** Return rule names only: matched credentials must never appear in scanner logs. */
export function scanText(contents) {
  return Object.entries(rules)
    .filter(([, pattern]) => pattern.test(contents))
    .map(([name]) => name);
}

function trackedFiles(root) {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: root });
  return output.toString("utf8").split("\0").filter(Boolean).map((path) => join(root, path));
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Secret scan refused a symbolic link");
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function builtFiles(root) {
  const roots = [...requiredBuildRoots];
  for (const packageName of ["ai", "comms", "config", "db", "import-engine", "import-normalize", "jobs", "types"]) {
    roots.push(`packages/${packageName}/dist`);
  }
  const byRoot = roots.map((path) => ({ files: walkFiles(join(root, path)), required: requiredBuildRoots.includes(path) }));
  return {
    files: byRoot.flatMap((entry) => entry.files),
    allRequiredPresent: byRoot.every((entry) => !entry.required || entry.files.length > 0)
  };
}

export function scanRepository(root, { requireBuilt = false } = {}) {
  const source = trackedFiles(root);
  const built = builtFiles(root);
  if (requireBuilt && !built.allRequiredPresent) throw new Error("Secret scan requires all server and client build artifacts");
  const violations = [];
  for (const path of new Set([...source, ...built.files])) {
    if (!existsSync(path) || !lstatSync(path).isFile()) continue;
    const contents = readFileSync(path).toString("utf8");
    violations.push(...scanText(contents));
  }
  return { scannedSource: source.length, scannedBuilt: built.files.length, violations };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(import.meta.dirname, "../..");
    const result = scanRepository(root, { requireBuilt: process.argv.includes("--require-built") });
    if (result.violations.length > 0) {
      console.error(`FS-76 secret scan failed (${result.violations.length} findings; details redacted)`);
      process.exitCode = 1;
    } else {
      console.log(`FS-76 secret scan ${SECRET_SCAN_POLICY_VERSION} passed (${result.scannedSource} tracked, ${result.scannedBuilt} built files)`);
    }
  } catch {
    console.error("FS-76 secret scan could not complete (details redacted)");
    process.exitCode = 1;
  }
}
