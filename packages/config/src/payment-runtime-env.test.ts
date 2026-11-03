import { describe, expect, it } from "vitest";

import { parseRuntimeEnv } from "./runtime-env.js";

describe("payment runtime environment", () => {
  it("requires the canonical platform fee value instead of inventing a zero default", () => {
    expect(() => parseRuntimeEnv("payment", {})).toThrow("STRIPE_PLATFORM_FEE_PERCENT");
    expect(parseRuntimeEnv("payment", { STRIPE_PLATFORM_FEE_PERCENT: "0" }).STRIPE_PLATFORM_FEE_PERCENT).toBe(0);
  });
});
