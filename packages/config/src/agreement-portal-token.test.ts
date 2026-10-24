import { describe, expect, it } from "vitest";

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
    const [payload, sig] = fresh.split(".");
    expect(mod.verifyAgreementPortalToken(`${payload!.split(":").slice(0, 2).join(":")}.${sig}`)).toBeNull();
  });
});
