import { describe, expect, it } from "vitest";

import { formatHistoryDepthSummary } from "./migrate-relational-preview-summary";

describe("formatHistoryDepthSummary", () => {
  it("describes multi-year history depth in plain language", () => {
    const summary = formatHistoryDepthSummary([
      {
        entity: "jobs",
        datedRowCount: 120,
        undatedRowCount: 2,
        earliestBusinessDate: "2022-01-01",
        latestBusinessDate: "2025-12-31",
        spanYears: 4,
        meetsMultiYearThreshold: true
      }
    ]);

    expect(summary).toContain("jobs");
    expect(summary).toContain("multi-year");
  });
});
