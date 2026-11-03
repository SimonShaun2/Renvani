import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RENDER_NEON_REGION_POLICY } from "./render-neon-region.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("STACK-12 render-neon-region", () => {
  it("policy anchors on API service and Neon", () => {
    expect(RENDER_NEON_REGION_POLICY.databaseProvider).toBe("neon");
    expect(RENDER_NEON_REGION_POLICY.anchorRenderService).toBe("api");
  });

  it("FS-93 runbook documents Neon (not Render Postgres)", () => {
    const runbook = readFileSync(join(repoRoot, "docs/platform/FS-93-render-runbook.md"), "utf8");
    expect(runbook).toContain("Neon");
    expect(runbook).not.toContain("Render Postgres");
  });
});
