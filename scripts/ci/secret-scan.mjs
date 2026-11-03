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

const buildGroups = Object.freeze([
  ["API", "apps/api/dist"], ["WORKER", "apps/worker/dist"],
  ["WEBHOOK", "apps/webhook/dist"], ["WEB_SERVER", "apps/web/.next/server"],
  ["WEB_STATIC", "apps/web/.next/static"],
  ...["ai", "comms", "config", "db", "import-engine", "import-normalize", "jobs", "types"]
    .map((name) => [`PACKAGE_${name.replaceAll("-", "_").toUpperCase()}`, `packages/${name}/dist`])
]);

class ScannerError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/** Return rule names only: matched credentials must never appear in scanner logs. */
export function scanText(contents) {
  return Object.entries(rules)
    .filter(([, pattern]) => pattern.test(contents))
    .map(([name]) => name);
}

function trackedFiles(root) {
  try {
    const output = execFileSync("git", ["ls-files", "-z"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
    return output.toString("utf8").split("\0").filter(Boolean).map((path) => join(root, path));
  } catch {
    throw new ScannerError("FS76_SCAN_GIT_FAILED");
  }
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  let entries;
  try {
    if (lstatSync(root).isSymbolicLink()) throw new ScannerError("FS76_SCAN_SYMLINK_REFUSED");
    entries = readdirSync(root, { withFileTypes: true });
  } catch (cause) {
    if (cause instanceof ScannerError) throw cause;
    throw new ScannerError("FS76_SCAN_WALK_FAILED");
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new ScannerError("FS76_SCAN_SYMLINK_REFUSED");
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function builtFiles(root) {
  return buildGroups.map(([group, path]) => ({ group, files: walkFiles(join(root, path)) }));
}

export function scanRepository(root, { requireBuilt = false } = {}) {
  const source = trackedFiles(root);
  const built = builtFiles(root);
  if (requireBuilt) {
    const missing = built.find(({ files }) => files.length === 0);
    if (missing) throw new ScannerError(`FS76_SCAN_BUILD_${missing.group}_MISSING`);
  }
  const counts = new Map();
  for (const { group, files } of [{ group: "SOURCE", files: source }, ...built]) {
    for (const path of new Set(files)) {
      let contents;
      try {
        if (!existsSync(path)) continue;
        const status = lstatSync(path);
        if (status.isSymbolicLink()) throw new ScannerError("FS76_SCAN_SYMLINK_REFUSED");
        if (!status.isFile()) continue;
        contents = readFileSync(path).toString("utf8");
      } catch (cause) {
        if (cause instanceof ScannerError) throw cause;
        throw new ScannerError("FS76_SCAN_READ_FAILED");
      }
      for (const rule of scanText(contents)) {
        const key = `${group}:${rule}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const violations = [...counts].map(([key, count]) => {
    const [group, rule] = key.split(":");
    return { group, rule, count };
  });
  return { scannedSource: source.length, scannedBuilt: built.reduce((sum, entry) => sum + entry.files.length, 0), violations };
}

export function runScan(root, { requireBuilt = false, log = console.log, error = console.error } = {}) {
  try {
    const result = scanRepository(root, { requireBuilt });
    if (result.violations.length > 0) {
      for (const { group, rule, count } of result.violations) error(`FS76_SCAN_FINDING ${group} ${rule} ${count}`);
      return false;
    }
    log(`FS76_SCAN_PASS ${SECRET_SCAN_POLICY_VERSION} ${result.scannedSource} ${result.scannedBuilt}`);
    return true;
  } catch (cause) {
    error(cause instanceof ScannerError ? cause.code : "FS76_SCAN_INTERNAL_FAILED");
    return false;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, "../..");
  if (!runScan(root, { requireBuilt: process.argv.includes("--require-built") })) process.exitCode = 1;
}
