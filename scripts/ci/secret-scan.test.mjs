import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { test } from "node:test";

import { scanRepository, scanText } from "./secret-scan.mjs";

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

    const serverRoots = ["apps/api/dist", "apps/worker/dist", "apps/webhook/dist", "apps/web/.next/server"];
    for (const path of serverRoots) {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, "artifact.js"), "export {};\n");
    }
    assert.throws(() => scanRepository(root, { requireBuilt: true }), /requires all server and client build artifacts/u);

    const clientPath = join(root, "apps/web/.next/static");
    mkdirSync(clientPath, { recursive: true });
    writeFileSync(join(clientPath, "artifact.js"), "export {};\n");
    const report = scanRepository(root, { requireBuilt: true });
    assert.deepEqual(report.violations, ["synthetic_canary"]);
    assert.equal(report.scannedBuilt, 5);
    assert.ok(!JSON.stringify(report).includes(sensitivePath));
    assert.ok(!JSON.stringify(report).includes(canary));

    rmSync(join(root, "apps/api/dist/artifact.js"));
    assert.throws(() => scanRepository(root, { requireBuilt: true }), /requires all server and client build artifacts/u);
  } finally {
    const resolvedRoot = realpathSync(root);
    assert.ok(resolvedRoot.startsWith(realpathSync(tmpdir()) + sep));
    rmSync(resolvedRoot, { recursive: true, force: true });
  }
});
