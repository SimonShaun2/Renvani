import { describe, expect, it } from "vitest";

import { goldenImportBundleManifestSchema } from "./golden-bundle-manifest.js";

describe("goldenImportBundleManifestSchema", () => {
  it("accepts a minimal multi-file manifest", () => {
    const parsed = goldenImportBundleManifestSchema.parse({
      fixtureId: "jobber-v1",
      sourceSystem: "jobber",
      label: "Jobber golden bundle",
      description: "Synthetic Jobber export bundle for CI.",
      files: [
        {
          relativePath: "clients.csv",
          entityType: "customers",
          presetEntityHint: "customers"
        },
        {
          relativePath: "jobs.csv",
          entityType: "jobs",
          presetEntityHint: "customers",
          joinLink: {
            parentFile: "clients.csv",
            localColumn: "Client ID",
            parentColumn: "Client ID"
          },
          businessDateColumn: "Completed On"
        }
      ],
      mediaRelativePaths: []
    });

    expect(parsed.fixtureId).toBe("jobber-v1");
    expect(parsed.files).toHaveLength(2);
  });

  it("accepts optional chunked job history on manual bundles", () => {
    const parsed = goldenImportBundleManifestSchema.parse({
      fixtureId: "manual_csv-v1",
      sourceSystem: "manual_csv",
      label: "Generic CSV golden bundle",
      description: "Chunked history fixture",
      requiredHistorySpanYears: 2,
      chunkedJobHistory: {
        relativeDir: "jobs_history",
        partFileNameFormat: "part-%02d.csv",
        partCount: 2,
        rowsPerPart: 1,
        totalDataRows: 2,
        workerRowChunkSize: 500,
        entityType: "jobs",
        presetEntityHint: "customers",
        joinLink: {
          parentFile: "customers.csv",
          localColumn: "customer_id",
          parentColumn: "customer_id"
        },
        businessDateColumn: "completed_at"
      },
      files: [
        {
          relativePath: "customers.csv",
          entityType: "customers",
          presetEntityHint: "customers"
        }
      ],
      mediaRelativePaths: []
    });

    expect(parsed.chunkedJobHistory?.totalDataRows).toBe(2);
  });
});
