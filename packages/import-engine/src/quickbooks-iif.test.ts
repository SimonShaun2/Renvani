import { describe, expect, it } from "vitest";

import { isQuickBooksIifFileName, parseQuickBooksIifToTable } from "./quickbooks-iif.js";

const SAMPLE_CUST_IIF = `!CUST\tNAME\tPHONE1\tEMAIL
CUST\tLegacy Air Co\t5550606001\tlegacy@example.test
`;

describe("QuickBooks IIF parser", () => {
  it("detects IIF file names", () => {
    expect(isQuickBooksIifFileName("customers.iif")).toBe(true);
    expect(isQuickBooksIifFileName("customers.csv")).toBe(false);
  });

  it("parses CUST records into tabular rows", () => {
    const table = parseQuickBooksIifToTable(SAMPLE_CUST_IIF, "CUST");
    expect(table?.recordType).toBe("CUST");
    expect(table?.headers).toContain("NAME");
    expect(table?.rows).toHaveLength(1);
    expect(table?.rows[0]?.NAME).toBe("Legacy Air Co");
    expect(table?.rows[0]?.EMAIL).toBe("legacy@example.test");
  });
});
