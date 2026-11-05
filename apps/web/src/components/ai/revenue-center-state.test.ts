import { describe, expect, it } from "vitest";

import { revenueActionButtonLabel, revenueDataState } from "./revenue-center-state";

describe("AI Revenue Center truthful UI states", () => {
  it("treats a successful zero-valued response as real data", () => {
    expect(revenueDataState({ isError: false, isLoading: false, data: { totalOpportunityValue: "0.00" } })).toBe("ready");
  });

  it("never turns an error or absent response into a zero", () => {
    expect(revenueDataState({ isError: true, isLoading: false, data: { totalOpportunityValue: "500.00" } })).toBe("unavailable");
    expect(revenueDataState({ isError: false, isLoading: false, data: undefined })).toBe("unavailable");
    expect(revenueDataState({ isError: false, isLoading: false, data: null })).toBe("unavailable");
    expect(revenueDataState({ isError: false, isLoading: true, data: undefined })).toBe("loading");
  });

  it("does not imply delivery for a recorded manual action", () => {
    expect(revenueActionButtonLabel(false)).toBe("Mark handled");
    expect(revenueActionButtonLabel(true)).toBe("Create proposal");
  });
});
