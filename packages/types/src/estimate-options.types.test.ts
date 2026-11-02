import { describe, expect, it } from "vitest";

import {
  ESTIMATE_OPTION_SET_MAX_OPTIONS,
  ESTIMATE_OPTION_SET_MIN_OPTIONS,
  FINANCING_PROVIDER_REGISTRY,
  estimateOptionSetCreateBodySchema,
  estimateOptionSetUpdateBodySchema,
  estimateOptionSetVersionedQuerySchema,
  estimateOptionTierRank
} from "./index.js";

const customerId = "00000000-0000-4000-8000-000000000001";
const opt = (tierLabel: string, extra: Record<string, unknown> = {}) => ({ tierLabel, items: [{ name: "Water heater", quantity: 1, unitPrice: 900 }], ...extra });

describe("FS-212 estimate option types", () => {
  it("ranks registry tiers and puts custom labels last", () => {
    expect(["Best", "good", " BETTER "].map(estimateOptionTierRank)).toEqual([3, 1, 2]);
    expect(estimateOptionTierRank("Premium")).toBe(99);
    expect(estimateOptionTierRank("__proto__")).toBe(99);
    expect([ESTIMATE_OPTION_SET_MIN_OPTIONS, ESTIMATE_OPTION_SET_MAX_OPTIONS]).toEqual([2, 3]);
  });

  it("accepts 2-3 options with unique labels and at most one recommended", () => {
    const ok = { idempotencyKey: "key-00001", customerId, options: [opt("Good"), opt("Best", { recommended: true })] };
    expect(estimateOptionSetCreateBodySchema.safeParse(ok).success).toBe(true);
    expect(estimateOptionSetCreateBodySchema.safeParse({ ...ok, options: [opt("Good")] }).success).toBe(false);
    expect(estimateOptionSetCreateBodySchema.safeParse({ ...ok, options: [opt("A"), opt("B"), opt("C"), opt("D")] }).success).toBe(false);
    expect(estimateOptionSetCreateBodySchema.safeParse({ ...ok, options: [opt("Good"), opt("GOOD")] }).success).toBe(false);
    expect(estimateOptionSetCreateBodySchema.safeParse({ ...ok, options: [opt("Good", { recommended: true }), opt("Best", { recommended: true })] }).success).toBe(false);
    expect(estimateOptionSetCreateBodySchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });

  it("requires a change on update and coerces delete query versions", () => {
    expect(estimateOptionSetUpdateBodySchema.safeParse({ idempotencyKey: "key-00001", expectedVersion: 1 }).success).toBe(false);
    expect(estimateOptionSetUpdateBodySchema.safeParse({ idempotencyKey: "key-00001", expectedVersion: 1, recommendedEstimateId: null }).success).toBe(true);
    expect(estimateOptionSetVersionedQuerySchema.parse({ idempotencyKey: "key-00001", expectedVersion: "3" }).expectedVersion).toBe(3);
  });

  it("financing registry is disabled-only", () => {
    expect(FINANCING_PROVIDER_REGISTRY).toEqual({ disabled: { label: "Not configured", enabled: false } });
  });
});
