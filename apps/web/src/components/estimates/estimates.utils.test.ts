import { describe, expect, it } from "vitest";

import { buildEstimatePublicPath } from "./estimates.utils";

describe("buildEstimatePublicPath", () => {
  it("uses the dedicated public approval route (not /estimates/:token)", () => {
    expect(buildEstimatePublicPath("customer-approval-token")).toBe("/approve/customer-approval-token");
    expect(buildEstimatePublicPath("customer-approval-token")).not.toMatch(/^\/estimates\//);
  });

  it("returns null when no token is provided", () => {
    expect(buildEstimatePublicPath(null)).toBeNull();
    expect(buildEstimatePublicPath(undefined)).toBeNull();
    expect(buildEstimatePublicPath("")).toBeNull();
  });
});

describe("matchesEstimateFilter (FS-174)", () => {
  it("treats viewed as sent and supports revised/converted", async () => {
    const { matchesEstimateFilter } = await import("./estimates.utils");
    expect(matchesEstimateFilter("viewed", "sent")).toBe(true);
    expect(matchesEstimateFilter("converted", "converted")).toBe(true);
    expect(matchesEstimateFilter("revised", "revised")).toBe(true);
    expect(matchesEstimateFilter("revised", "draft")).toBe(false);
    expect(matchesEstimateFilter("declined", "all")).toBe(true);
  });
});
