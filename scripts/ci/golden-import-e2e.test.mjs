import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("golden-import-e2e script is wired for Neon-only execution", () => {
  const script = readFileSync(join(repoRoot, "scripts/ci/golden-import-e2e.mjs"), "utf8");
  assert.match(script, /validateNeonCiDatabaseUrl/);
  assert.match(script, /golden-import-e2e\.integration\.test\.ts/);
  assert.match(script, /QuickBooks Desktop \+ Service Fusion/);
});

test("batch-ci workflow runs golden import e2e script", () => {
  const workflow = readFileSync(join(repoRoot, ".github/workflows/batch-ci.yml"), "utf8");
  assert.match(workflow, /golden-import-e2e\.mjs/);
});
