import { describe, expect, it } from "vitest";

import {
  normalizeImportedAssetType,
  normalizeImportedIsoDate,
  parseImportedBoolean,
  pickLastServiceDate,
} from "./import-equipment-commit.logic.js";

describe("import-equipment-commit.logic", () => {
  it("normalizes vendor install dates to ISO date strings", () => {
    expect(normalizeImportedIsoDate("3/15/2019")).toBe("2019-03-15");
    expect(normalizeImportedIsoDate("2019-03-15")).toBe("2019-03-15");
  });

  it("normalizes asset type labels", () => {
    expect(normalizeImportedAssetType("HVAC Unit")).toBe("hvac_unit");
  });

  it("parses active flags from export text", () => {
    expect(parseImportedBoolean("inactive", true)).toBe(false);
    expect(parseImportedBoolean("yes", false)).toBe(true);
  });

  it("prefers explicit last service date over job completion", () => {
    const fromJob = pickLastServiceDate(null, new Date("2020-06-01T15:00:00.000Z"));
    expect(fromJob).toBe("2020-06-01");

    const explicit = pickLastServiceDate("2018-01-10", new Date("2020-06-01T15:00:00.000Z"));
    expect(explicit).toBe("2018-01-10");
  });
});
