import { describe, expect, it } from "vitest";

import {
  buildImportSessionReconciliationReport,
  buildSkippedRowRecordsFromValidationErrors
} from "./import-session-reconciliation.js";

describe("import-session-reconciliation", () => {
  it("summarizes validation and duplicate skip reasons", () => {
    const report = buildImportSessionReconciliationReport(
      {
        importSessionId: "11111111-1111-4111-8111-111111111111",
        entityType: "customers",
        fileName: "customers.csv",
        status: "completed",
        totalRows: 10,
        importedRows: 7,
        skippedRows: 3,
        duplicateRows: 2,
        errorRows: 1,
        validationErrors: [
          { row: 4, field: "email", message: "Invalid email", value: "bad" }
        ],
        progress: null
      },
      "imports/company/session/skipped-rows.csv"
    );

    expect(report.reasonSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "validation_error", count: 1 }),
        expect.objectContaining({ code: "duplicate_skipped", count: 2 })
      ])
    );

    const records = buildSkippedRowRecordsFromValidationErrors([
      { row: 4, field: "email", message: "Invalid email", value: "bad" }
    ]);
    expect(records[0]?.rowNumber).toBe(4);
  });
});
