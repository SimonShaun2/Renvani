import { describe, expect, it } from "vitest";

import { mapNoteImportRow, validateNoteImportRows } from "./import-notes-rows.js";

describe("import-notes-commit", () => {
  const columnMapping = {
    "Note ID": "sourceId",
    "Customer ID": "customerSourceId",
    "Job ID": "jobSourceId",
    Note: "content",
    Visibility: "visibility",
    "Created At": "notedAt",
  };

  it("maps customer internal notes with visibility flags", () => {
    const mapped = mapNoteImportRow(
      {
        "Note ID": "n-100",
        "Customer ID": "cust-22",
        Note: "Gate code 4455",
        Visibility: "internal",
        "Created At": "2021-03-01",
      },
      columnMapping,
    );

    expect(mapped).toMatchObject({
      sourceId: "n-100",
      scope: "customer",
      customerSourceId: "cust-22",
      isInternal: true,
      content: "Gate code 4455",
    });
  });

  it("maps job customer-visible notes", () => {
    const mapped = mapNoteImportRow(
      {
        "Note ID": "jn-9",
        "Job ID": "job-88",
        Note: "Please call before arrival",
        Visibility: "customer",
      },
      columnMapping,
    );

    expect(mapped).toMatchObject({
      scope: "job",
      jobSourceId: "job-88",
      isInternal: false,
    });
  });

  it("flags duplicate note ids in validation", () => {
    const result = validateNoteImportRows(
      [
        {
          rowNumber: 2,
          values: {
            "Note ID": "dup",
            "Customer ID": "c-1",
            Note: "First",
          },
        },
        {
          rowNumber: 3,
          values: {
            "Note ID": "dup",
            "Job ID": "j-1",
            Note: "Second",
          },
        },
      ],
      columnMapping,
    );

    expect(result.errorRows).toBe(1);
    expect(result.validationErrors[0]?.field).toBe("sourceId");
  });
});
