import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { test } from "node:test";

import { runScan, scanRepository, scanText } from "./secret-scan.mjs";

test("synthetic canary proves scanner is active without logging values", () => {
  const canary = "FS76_SCANNER_CANARY_" + "ABCDEFGH" + "JKLMNPQR";
  assert.deepEqual(scanText(canary), ["synthetic_canary"]);
});

test("scanner recognizes provider secrets and private-key envelopes", () => {
  const stripe = "sk_live_" + "A".repeat(24);
  const pem = "-----BEGIN PRIVATE KEY-----\n" + "A".repeat(100) + "\n-----END PRIVATE KEY-----";
  assert.deepEqual(scanText(stripe), ["provider_secret"]);
  assert.deepEqual(scanText(pem), ["private_key"]);
});

test("names and test placeholders do not trigger a finding", () => {
  assert.deepEqual(scanText("STRIPE_SECRET_KEY=sk_test_placeholder"), []);
});

test("required server and client builds fail closed and findings redact paths and contents", () => {
  const root = mkdtempSync(join(tmpdir(), "fs76-secret-scan-"));
  const canary = "FS76_SCANNER_CANARY_" + "ABCDEFGH" + "JKLMNPQR";
  const sensitivePath = "synthetic-private-filename.txt";
  try {
    execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
    writeFileSync(join(root, sensitivePath), canary);
    execFileSync("git", ["add", sensitivePath], { cwd: root, stdio: "ignore" });

    const buildRoots = [
      "apps/api/dist", "apps/worker/dist", "apps/webhook/dist", "apps/web/.next/server",
      "apps/web/.next/static", ...["ai", "comms", "config", "db", "import-engine", "import-normalize", "jobs", "types"]
        .map((name) => `packages/${name}/dist`)
    ];
    for (const path of buildRoots.slice(0, 1)) {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, "artifact.js"), "export {};\n");
    }
    assert.throws(() => scanRepository(root, { requireBuilt: true }), /FS76_SCAN_BUILD_WORKER_MISSING/u);

    for (const path of buildRoots.slice(1)) {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, "artifact.js"), "export {};\n");
    }
    const report = scanRepository(root, { requireBuilt: true });
    assert.deepEqual(report.violations, [{ group: "SOURCE", rule: "synthetic_canary", count: 1 }]);
    assert.equal(report.scannedBuilt, buildRoots.length);
    assert.ok(!JSON.stringify(report).includes(sensitivePath));
    assert.ok(!JSON.stringify(report).includes(canary));
    const output = [];
    assert.equal(runScan(root, { requireBuilt: true, log: (line) => output.push(line), error: (line) => output.push(line) }), false);
    assert.deepEqual(output, ["FS76_SCAN_FINDING SOURCE synthetic_canary 1"]);
    assert.ok(!output.join(" ").includes(sensitivePath));
    assert.ok(!output.join(" ").includes(canary));

    rmSync(join(root, "apps/api/dist/artifact.js"));
    assert.throws(() => scanRepository(root, { requireBuilt: true }), /FS76_SCAN_BUILD_API_MISSING/u);
    const missingOutput = [];
    assert.equal(runScan(root, { requireBuilt: true, error: (line) => missingOutput.push(line) }), false);
    assert.deepEqual(missingOutput, ["FS76_SCAN_BUILD_API_MISSING"]);

    writeFileSync(join(root, "apps/api/dist/artifact.js"), "export {};\n");
    const sensitiveLink = join(root, "apps/api/dist/private-link");
    symlinkSync(join(root, "apps/web/.next/static"), sensitiveLink, "junction");
    const linkOutput = [];
    assert.equal(runScan(root, { requireBuilt: true, error: (line) => linkOutput.push(line) }), false);
    assert.deepEqual(linkOutput, ["FS76_SCAN_SYMLINK_REFUSED"]);
    assert.ok(!linkOutput.join(" ").includes(sensitiveLink));
  } finally {
    const resolvedRoot = realpathSync(root);
    assert.ok(resolvedRoot.startsWith(realpathSync(tmpdir()) + sep));
    rmSync(resolvedRoot, { recursive: true, force: true });
  }
});
