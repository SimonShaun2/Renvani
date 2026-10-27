import { describe, expect, it } from "vitest";

import {
  mapServiceAgreementImportRow,
  validateServiceAgreementImportRows,
} from "./import-service-agreements-rows.js";

describe("import-service-agreements-commit", () => {
  const columnMapping = {
    "Agreement ID": "sourceId",
    "Customer ID": "customerSourceId",
    "Plan Name": "name",
    "Next Due Date": "nextServiceDate",
    "Start Date": "startDate",
    Frequency: "frequency",
    Status: "status",
    Price: "price",
  };

  it("maps agreement rows with customer link and next due date", () => {
    const mapped = mapServiceAgreementImportRow(
      {
        "Agreement ID": "sa-100",
        "Customer ID": "cust-22",
        "Plan Name": "Gold HVAC Plan",
        "Next Due Date": "2026-04-01",
        "Start Date": "2025-04-01",
        Frequency: "Annual",
        Status: "Active",
        Price: "$199.00",
      },
      columnMapping,
    );

    expect(mapped).toMatchObject({
      sourceId: "sa-100",
      customerSourceId: "cust-22",
      name: "Gold HVAC Plan",
      nextServiceDate: "2026-04-01",
      startDate: "2025-04-01",
      frequency: "annual",
      status: "active",
      price: "199.00",
    });
  });

  it("flags duplicate agreement ids in validation", () => {
    const result = validateServiceAgreementImportRows(
      [
        {
          rowNumber: 2,
          values: {
            "Agreement ID": "dup",
            "Customer ID": "c-1",
            "Plan Name": "Plan A",
            "Next Due Date": "2026-01-01",
          },
        },
        {
          rowNumber: 3,
          values: {
            "Agreement ID": "dup",
            "Customer ID": "c-2",
            "Plan Name": "Plan B",
            "Next Due Date": "2026-02-01",
          },
        },
      ],
      columnMapping,
    );

    expect(result.errorRows).toBe(1);
    expect(result.validationErrors[0]?.field).toBe("sourceId");
  });

  it("keeps a stable vendor source id when agreement fields change on re-import", () => {
    const first = mapServiceAgreementImportRow(
      {
        "Agreement ID": "sa-200",
        "Customer ID": "cust-1",
        "Plan Name": "Original Plan",
        "Next Due Date": "2026-01-01",
      },
      columnMapping,
    );
    const second = mapServiceAgreementImportRow(
      {
        "Agreement ID": "sa-200",
        "Customer ID": "cust-1",
        "Plan Name": "Renamed Plan",
        "Next Due Date": "2026-02-01",
      },
      columnMapping,
    );

    expect(first?.sourceId).toBe("sa-200");
    expect(second?.sourceId).toBe("sa-200");
    expect(second?.name).toBe("Renamed Plan");
    expect(second?.nextServiceDate).toBe("2026-02-01");
  });
});
