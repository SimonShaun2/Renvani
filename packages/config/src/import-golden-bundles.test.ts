import { describe, expect, it } from "vitest";

import { MIGRATE_ONBOARDING_SOURCE_CATALOG } from "@fsm/types";

import {
  GOLDEN_IMPORT_BUNDLE_MANIFESTS,
  assertGoldenImportBundleManifest,
  validateGoldenImportBundleManifest
} from "./import-golden-bundles/index.js";

describe("FS-MIGRATE golden import bundles (CI fixtures)", () => {
  it("covers every onboarding source in the catalog", () => {
    const catalogIds = MIGRATE_ONBOARDING_SOURCE_CATALOG.map((entry) => entry.id);
    const manifestIds = GOLDEN_IMPORT_BUNDLE_MANIFESTS.map((entry) => entry.sourceSystem);

    expect(manifestIds.sort()).toEqual(catalogIds.sort());
  });

  it("validates each manifest (files, joins, generic mapping, QB presets, history depth)", () => {
    for (const manifest of GOLDEN_IMPORT_BUNDLE_MANIFESTS) {
      assertGoldenImportBundleManifest(manifest);
    }
  });

  it("validates Housecall Pro golden bundle presets and ≥2y history", () => {
    const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((entry) => entry.sourceSystem === "housecall_pro");
    expect(manifest).toBeDefined();
    assertGoldenImportBundleManifest(manifest!);
    expect(manifest?.requiredHistorySpanYears).toBeGreaterThanOrEqual(2);
    expect(manifest?.files.some((file) => file.entityType === "jobs")).toBe(true);
    expect(manifest?.files.some((file) => file.entityType === "invoices")).toBe(true);
  });

  it("ServiceTitan golden bundle is location-aware with ST preset contract coverage", () => {
    const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((entry) => entry.sourceSystem === "servicetitan");
    expect(manifest).toBeDefined();
    expect(manifest?.files.some((file) => file.relativePath === "locations.csv")).toBe(true);
    assertGoldenImportBundleManifest(manifest!);
  });

  it("requires price book files for Service Fusion and Jobber epic §6 fixtures", () => {
    for (const source of ["service_fusion", "jobber"] as const) {
      const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((entry) => entry.sourceSystem === source);
      expect(manifest).toBeDefined();
      expect(manifest?.files.some((file) => file.entityType === "products")).toBe(true);
      expect(manifest?.requiredHistorySpanYears).toBeGreaterThanOrEqual(2);
    }
  });

  it("Jobber golden bundle ships clients, jobs, invoices, payments with CI-gated presets", () => {
    const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((entry) => entry.sourceSystem === "jobber");
    expect(manifest).toBeDefined();
    const entityTypes = manifest?.files.map((file) => file.entityType).sort();
    expect(entityTypes).toContain("customers");
    expect(entityTypes).toContain("jobs");
    expect(entityTypes).toContain("invoices");
    expect(entityTypes).toContain("payments");
    assertGoldenImportBundleManifest(manifest!);
  });

  it("includes media paths for Service Fusion file-batch smoke tests", () => {
    const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((entry) => entry.sourceSystem === "service_fusion");
    expect(manifest?.mediaRelativePaths.length).toBeGreaterThanOrEqual(2);
  });

  it("manual_csv includes ~100k-row chunked job history aligned with worker chunk size", () => {
    const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((entry) => entry.sourceSystem === "manual_csv");
    expect(manifest?.chunkedJobHistory?.totalDataRows).toBe(100_000);
    expect(manifest?.chunkedJobHistory?.workerRowChunkSize).toBe(500);
    expect(manifest?.requiredHistorySpanYears).toBeGreaterThanOrEqual(2);
    const workerChunks = Math.ceil(
      (manifest?.chunkedJobHistory?.totalDataRows ?? 0) /
        (manifest?.chunkedJobHistory?.workerRowChunkSize ?? 1)
    );
    expect(workerChunks).toBe(200);
  });

  it("returns structured issues instead of throwing when validation fails", () => {
    const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS[0];
    const result = validateGoldenImportBundleManifest({
      ...manifest,
      files: manifest.files.map((file) =>
        file.relativePath === "customers.csv"
          ? { ...file, joinLink: { parentFile: "missing.csv", localColumn: "x", parentColumn: "y" } }
          : file
      )
    });

    expect(result.issues.length).toBeGreaterThan(0);
  });
});
