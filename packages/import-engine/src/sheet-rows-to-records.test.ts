import { describe, expect, it } from "vitest";

import { sheetRowsToRecordRows } from "./sheet-rows-to-records.js";

describe("sheetRowsToRecordRows", () => {
  it("maps headers to sanitized cell values", () => {
    const records = sheetRowsToRecordRows(["id", "note"], [["1", "=cmd"]]);
    expect(records).toEqual([{ id: "1", note: "'=cmd" }]);
  });
});
