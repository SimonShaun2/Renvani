import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parseXlsxBufferToSheetRows } from "./xlsx-to-rows.js";

describe("parseXlsxBufferToSheetRows", () => {
  it("parses first sheet headers and rows", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Customer ID", "Name"],
      ["c1", "Acme"]
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Customers");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = parseXlsxBufferToSheetRows(buffer);
    expect(parsed.sheetName).toBe("Customers");
    expect(parsed.headers).toEqual(["Customer ID", "Name"]);
    expect(parsed.rows).toEqual([["c1", "Acme"]]);
  });

  it("accepts Uint8Array buffers and pads ragged rows", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["A", "B"],
      ["only-a"]
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const arrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const uint8 = new Uint8Array(arrayBuffer);

    const parsed = parseXlsxBufferToSheetRows(uint8);
    expect(parsed.headers).toEqual(["A", "B"]);
    expect(parsed.rows).toEqual([["only-a", ""]]);
  });

  it("returns empty rows when the sheet has only a header row", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["Customer ID"]]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Customers");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const parsed = parseXlsxBufferToSheetRows(buffer);
    expect(parsed.headers).toEqual(["Customer ID"]);
    expect(parsed.rows).toEqual([]);
  });
});
