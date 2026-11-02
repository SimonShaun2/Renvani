import { describe, expect, it } from "vitest";

import {
  GROWTH_CHECK_REVIEW_ACTION_REGISTRY,
  HOME_SERVICES_RUBRIC_TRADES,
  HOME_SERVICES_RUBRIC_V1,
  getGrowthCheckRubricById,
  getGrowthCheckRubricCheckLabel,
  growthCheckFindingReviewBodySchema
} from "./index.js";

describe("FS-56 findings review types", () => {
  it("registers the home services rubric for hvac/plumbing/electrical", () => {
    expect(getGrowthCheckRubricById("home-services")).toBe(HOME_SERVICES_RUBRIC_V1);
    expect(HOME_SERVICES_RUBRIC_TRADES).toEqual(["hvac", "plumbing", "electrical"]);
    const check = HOME_SERVICES_RUBRIC_V1.areas[0]!.checks[0]!;
    expect(getGrowthCheckRubricCheckLabel("home-services", check.id)).toBe(check.label);
    expect(getGrowthCheckRubricCheckLabel("unknown", check.id)).toBeNull();
  });

  it("marks owner answers as owner-only", () => {
    const ownerOnly = GROWTH_CHECK_REVIEW_ACTION_REGISTRY.filter((a) => a.ownerOnly).map((a) => a.key);
    expect(ownerOnly).toEqual(["owner_confirm", "owner_reject", "owner_cannot_answer"]);
  });

  it("validates review bodies strictly", () => {
    const base = { expectedRevision: 0, idempotencyKey: "abcdefgh" };
    expect(growthCheckFindingReviewBodySchema.safeParse({ action: "edit", reason: "fix it", status: "pass", ...base }).success).toBe(true);
    expect(growthCheckFindingReviewBodySchema.safeParse({ action: "edit", reason: "fix it", ...base }).success).toBe(false);
    expect(growthCheckFindingReviewBodySchema.safeParse({ action: "dismiss", reason: "nope", extra: 1, ...base }).success).toBe(false);
    expect(growthCheckFindingReviewBodySchema.safeParse({ action: "promote", ...base }).success).toBe(false);
  });
});
