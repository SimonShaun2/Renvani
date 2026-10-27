import { describe, expect, it } from "vitest";

import {
  normalizeImportedIsoDate,
  normalizeImportedMaintenancePlanFrequency,
  normalizeImportedMaintenancePlanStatus,
  parseImportedMaintenancePlanPrice,
} from "./import-service-agreements-map.js";

describe("import-service-agreements-map", () => {
  it("normalizes vendor dates to ISO date strings", () => {
    expect(normalizeImportedIsoDate("3/15/2026")).toBe("2026-03-15");
    expect(normalizeImportedIsoDate("2026-03-15")).toBe("2026-03-15");
  });

  it("maps frequency and status labels", () => {
    expect(normalizeImportedMaintenancePlanFrequency("Semi-Annual")).toBe("bi_annual");
    expect(normalizeImportedMaintenancePlanStatus("On Hold")).toBe("paused");
  });

  it("parses currency amounts", () => {
    expect(parseImportedMaintenancePlanPrice("$199.50")).toBe("199.50");
  });
});
