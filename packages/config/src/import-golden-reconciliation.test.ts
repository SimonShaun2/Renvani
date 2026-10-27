import { describe, expect, it } from "vitest";

import { buildImportSessionReconciliationReport } from "@fsm/import-engine";

import { GOLDEN_IMPORT_BUNDLE_MANIFESTS } from "./import-golden-bundles/index.js";
import { readGoldenImportBundleFile } from "./import-golden-bundles/io.js";
import { parseGoldenBundleTabularTable } from "./import-golden-bundles/tabular.js";

describe("FS-150 golden bundle reconciliation counts", () => {
  it("matches source row counts for Jobber, ServiceTitan, and Housecall Pro fixtures", () => {
    for (const source of ["jobber", "servicetitan", "housecall_pro"] as const) {
      const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((entry) => entry.sourceSystem === source);
      expect(manifest).toBeDefined();

      for (const file of manifest!.files) {
        const content = readGoldenImportBundleFile(source, file.relativePath);
        const { rows } = parseGoldenBundleTabularTable(content, file.relativePath, file.entityType);
        const sourceRowCount = rows.length;

        const report = buildImportSessionReconciliationReport(
          {
            importSessionId: "11111111-1111-4111-8111-111111111111",
            entityType: file.entityType,
            fileName: file.relativePath,
            status: "completed",
            totalRows: sourceRowCount,
            importedRows: sourceRowCount,
            skippedRows: 0,
            duplicateRows: 0,
            errorRows: 0,
            validationErrors: [],
            progress: null
          },
          null
        );

        expect(report.sourceRowCount).toBe(sourceRowCount);
        expect(report.committedRowCount).toBe(sourceRowCount);
        expect(report.sourceRowCount).toBe(report.committedRowCount + report.skippedRowCount);
      }
    }
  });
});
