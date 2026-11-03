import { describe, expect, it } from "vitest";

import {
  GOLDEN_IMPORT_BUNDLE_MANIFESTS,
  assertGoldenImportBundleManifest
} from "@fsm/config/import-golden-bundles";

describe("FS-MIGRATE golden bundles (worker CI smoke)", () => {
  it("loads and validates all golden bundle manifests from disk", () => {
    expect(GOLDEN_IMPORT_BUNDLE_MANIFESTS.length).toBeGreaterThanOrEqual(7);
    for (const manifest of GOLDEN_IMPORT_BUNDLE_MANIFESTS) {
      assertGoldenImportBundleManifest(manifest);
    }
  });
});
