import { describe, expect, it } from "vitest";

import {
  buildPresetColumnMapping,
  inferImportSourcePresetFromHeaders
} from "../import-source-presets.js";
import {
  assertGoldenImportBundleManifest,
  getGoldenImportBundleManifest,
  readGoldenImportBundleFile
} from "./index.js";
import { parseCsvTable } from "./csv.js";

const FS_MIGRATE_SERVICETITAN_GOLDEN_CONTRACT_ID = "FS-MIGRATE-servicetitan-golden-v1";

describe(`${FS_MIGRATE_SERVICETITAN_GOLDEN_CONTRACT_ID}`, () => {
  const manifest = getGoldenImportBundleManifest("servicetitan");

  it("validates bundle files, joins, history depth, and ST preset inference", () => {
    assertGoldenImportBundleManifest(manifest);
  });

  it("maps each tabular export through ServiceTitan presets (generic importer path)", () => {
    const expectations: Array<{
      relativePath: string;
      presetId: string;
      entityHint: "customers" | "invoices";
      minMappedFields: number;
    }> = [
      { relativePath: "customers.csv", presetId: "service_titan", entityHint: "customers", minMappedFields: 4 },
      {
        relativePath: "locations.csv",
        presetId: "service_titan_locations",
        entityHint: "customers",
        minMappedFields: 4
      },
      { relativePath: "jobs.csv", presetId: "service_titan_jobs", entityHint: "customers", minMappedFields: 4 },
      {
        relativePath: "invoices.csv",
        presetId: "service_titan_invoices",
        entityHint: "invoices",
        minMappedFields: 4
      }
    ];

    for (const entry of expectations) {
      const content = readGoldenImportBundleFile("servicetitan", entry.relativePath);
      const { headers } = parseCsvTable(content);
      const presetId = inferImportSourcePresetFromHeaders(headers, entry.entityHint);
      expect(presetId).toBe(entry.presetId);
      const mapping = buildPresetColumnMapping(headers, presetId!);
      expect(Object.keys(mapping).length).toBeGreaterThanOrEqual(entry.minMappedFields);
    }
  });
});
