import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildPresetColumnMapping } from "@fsm/config/import-source-presets";

import { mapServiceAgreementImportRow } from "./import-service-agreements-rows.js";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../config/fixtures/import-golden-bundles/manual_csv",
);

describe("manual_csv maintenance_plans golden fixture", () => {
  it("maps golden agreement rows with customer link and next due date", () => {
    const csv = readFileSync(join(fixtureDir, "maintenance_plans.csv"), "utf8");
    const lines = csv.trim().split("\n");
    const headerLine = lines[0];
    const firstDataLine = lines[1];
    if (!headerLine || !firstDataLine) {
      throw new Error("golden maintenance_plans.csv must include header and data rows");
    }
    const headers = headerLine.split(",");
    const values = firstDataLine.split(",");
    const rowValues = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const columnMapping = buildPresetColumnMapping(headers, "generic", "service_agreements");

    const mapped = mapServiceAgreementImportRow(rowValues, columnMapping);

    expect(mapped).toMatchObject({
      sourceId: "sa-golden-001",
      customerSourceId: "GEN-C-001",
      name: "Comfort Club HVAC",
      nextServiceDate: "2026-06-15",
    });
  });
});
