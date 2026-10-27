import { describe, expect, it } from "vitest";

import {
  assertGoldenImportBundleManifest,
  getGoldenImportBundleManifest
} from "@fsm/config/import-golden-bundles";
import { importSourceSystemFromPreset } from "@fsm/config/import-price-book-map";
import { inferImportSourcePresetForSession } from "@fsm/config/import-source-presets";

describe("FS-139 Jobber golden bundle + preset contracts", () => {
  it("validates the Jobber golden fixture manifest on disk", () => {
    const manifest = getGoldenImportBundleManifest("jobber");
    expect(manifest.sourceSystem).toBe("jobber");
    assertGoldenImportBundleManifest(manifest);
  });

  it("infers Jobber presets for core export shapes with jobber lineage", () => {
    expect(
      inferImportSourcePresetForSession(
        ["Client ID", "First Name", "Last Name", "Email", "Mobile Phone"],
        "customers"
      )
    ).toBe("jobber");

    expect(
      inferImportSourcePresetForSession(
        ["Payment ID", "Client ID", "Payment Date", "Amount", "Invoice Number"],
        "payments"
      )
    ).toBe("jobber_payments");

    expect(importSourceSystemFromPreset("jobber_invoices")).toBe("jobber");
  });
});
