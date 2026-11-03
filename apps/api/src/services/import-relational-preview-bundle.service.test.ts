import { describe, expect, it } from "vitest";

import { mappedImportPreviewRowsFromCsv } from "./import-relational-preview.service.js";

describe("import-relational-preview-bundle.service", () => {
  it("maps CSV values to canonical preview fields via column mapping", () => {
    const rows = mappedImportPreviewRowsFromCsv(
      [
        {
          rowNumber: 2,
          values: {
            vendor_customer_id: "C-1",
            company_name: "Acme"
          }
        }
      ],
      {
        vendor_customer_id: "sourceId",
        company_name: "displayName"
      }
    );

    expect(rows).toEqual([
      {
        row: 2,
        fields: {
          sourceId: "C-1",
          displayName: "Acme"
        }
      }
    ]);
  });
});
