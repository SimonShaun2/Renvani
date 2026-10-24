import { describe, expect, it, vi } from "vitest";

import { signAgreementPortalToken, verifyAgreementPortalToken } from "./agreement-portal-token.js";

describe("agreement-portal-token", () => {
  it("round-trips portal tokens", () => {
    const token = signAgreementPortalToken(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002"
    );
    const parsed = verifyAgreementPortalToken(token);
    expect(parsed).toEqual({
      companyId: "00000000-0000-4000-8000-000000000001",
      agreementId: "00000000-0000-4000-8000-000000000002"
    });
  });

  it("rejects tampered tokens", () => {
    const token = signAgreementPortalToken(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002"
    );
    expect(verifyAgreementPortalToken(`${token}x`)).toBeNull();
  });
});

describe("agreement portal token expiry", () => {
  it("rejects expired and legacy (no-exp) tokens", async () => {
    const mod = await import("./agreement-portal-token.js");
    const fresh = mod.signAgreementPortalToken("c1", "a1");
    expect(mod.verifyAgreementPortalToken(fresh)).toEqual({ companyId: "c1", agreementId: "a1" });
    const expired = mod.signAgreementPortalToken("c1", "a1", -10);
    expect(mod.verifyAgreementPortalToken(expired)).toBeNull();
  });
});

describe("agreement-portal-token legacy grace period", () => {
  it("accepts no-exp legacy tokens before LEGACY_TOKEN_CUTOFF and rejects them after", async () => {
    const { createHmac } = await import("node:crypto");
    const { env } = await import("./env.js");
    const mod = await import("./agreement-portal-token.js");
    const payload = "c1:a1";
    const legacy = `${payload}.${createHmac("sha256", env.JWT_SECRET).update(payload).digest("base64url")}`;
    const cutoff = mod.LEGACY_TOKEN_CUTOFF.getTime();
    try {
      vi.useFakeTimers();
      vi.setSystemTime(cutoff - 1000);
      expect(mod.verifyAgreementPortalToken(legacy)).toEqual({ companyId: "c1", agreementId: "a1" });
      expect(mod.verifyAgreementPortalToken(`${payload}.badsig`)).toBeNull();
      vi.setSystemTime(cutoff + 1000);
      expect(mod.verifyAgreementPortalToken(legacy)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
