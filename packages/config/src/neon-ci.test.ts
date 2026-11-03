import { describe, expect, it } from "vitest";

import { isNeonProdDatabaseUrl, validateNeonCiDatabaseUrl } from "./neon-ci.js";

describe("isNeonProdDatabaseUrl", () => {
  it("flags prod host patterns", () => {
    expect(
      isNeonProdDatabaseUrl("postgresql://user:pass@ep-prod-foo.us-east-1.aws.neon.tech/neondb")
    ).toBe(true);
  });

  it("allows staging per-PR host patterns", () => {
    expect(
      isNeonProdDatabaseUrl(
        "postgresql://user:pass@ep-staging-pr-42.us-east-1.aws.neon.tech/neondb"
      )
    ).toBe(false);
  });
});

describe("validateNeonCiDatabaseUrl", () => {
  it("skips when no CI database URL is configured", () => {
    expect(validateNeonCiDatabaseUrl({})).toEqual({ ok: true, mode: "skip" });
  });

  it("rejects prod Neon URLs", () => {
    const result = validateNeonCiDatabaseUrl({
      NEON_CI_DATABASE_URL:
        "postgresql://user:pass@ep-production-data.us-east-1.aws.neon.tech/neondb",
      RENVANI_DEPLOYMENT_TIER: "staging"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NEON_PROD_FORBIDDEN");
    }
  });

  it("accepts staging per-PR Neon URL", () => {
    expect(
      validateNeonCiDatabaseUrl({
        NEON_CI_DATABASE_URL:
          "postgresql://user:pass@ep-staging-pr-99.us-east-1.aws.neon.tech/neondb",
        RENVANI_DEPLOYMENT_TIER: "staging"
      })
    ).toEqual({ ok: true, mode: "staging" });
  });
});
