import { describe, expect, it } from "vitest";
import { ESTIMATE_LIST_LIMIT, estimateListIsPartial } from "./estimate-list-limit";

describe("estimates listing API contract", () => {
  it("never requests beyond GET /estimates maximum of 100", () => {
    expect(ESTIMATE_LIST_LIMIT).toBe(100);
    expect(ESTIMATE_LIST_LIMIT).toBeLessThanOrEqual(100);
  });
  it("marks incomplete listings without claiming older records are searchable", () => {
    expect(estimateListIsPartial({ total: 120, data: Array(100).fill({}) })).toBe(true);
    expect(estimateListIsPartial({ total: 0, data: [] })).toBe(false);
    expect(estimateListIsPartial({ total: 3, data: Array(3).fill({}) })).toBe(false);
    expect(estimateListIsPartial(undefined)).toBe(false);
  });
});
