import { describe, expect, it } from "vitest";

import { mapPriceBookRow, validatePriceBookRows } from "./import-price-book-rows.js";

describe("import-price-book-commit", () => {
  const columnMapping = {
    Name: "name",
    SKU: "sku",
    Type: "type",
    "Sales Price": "unitPrice",
    "Item ID": "sourceId"
  };

  it("maps QB Desktop style rows into catalog fields", () => {
    const mapped = mapPriceBookRow(
      {
        Name: "Capacitor 45/5",
        SKU: "CAP-455",
        Type: "Inventory Part",
        "Sales Price": "$89.00",
        "Item ID": "qbd-991"
      },
      columnMapping,
      "qbd"
    );

    expect(mapped).toMatchObject({
      sourceId: "qbd-991",
      name: "Capacitor 45/5",
      sku: "CAP-455",
      category: "material",
      unitPrice: "89.00"
    });
  });

  it("flags duplicate source ids in validation", () => {
    const result = validatePriceBookRows(
      [
        { rowNumber: 2, values: { Name: "A", "Item ID": "dup-1", "Sales Price": "10" } },
        { rowNumber: 3, values: { Name: "B", "Item ID": "dup-1", "Sales Price": "12" } }
      ],
      columnMapping,
      "qbo"
    );

    expect(result.errorRows).toBe(1);
    expect(result.validationErrors[0]?.field).toBe("sourceId");
  });
});
