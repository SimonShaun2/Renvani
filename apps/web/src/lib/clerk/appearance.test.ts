import { describe, expect, it } from "vitest";

import { renvaniClerkAppearance, renvaniClerkSignInAppearance, renvaniClerkSignInLocalization } from "./appearance";

describe("Renvani Figma sign-in appearance", () => {
  it("uses the dedicated Figma sign-in palette and card dimensions", () => {
    expect(renvaniClerkSignInLocalization.signIn.start.title).toBe("Sign in to Renvani");
    expect(renvaniClerkSignInAppearance.variables.colorPrimary).toBe("#f6b400");
    expect(renvaniClerkSignInAppearance.variables.colorText).toBe("#0f1530");
    expect(renvaniClerkSignInAppearance.elements.card).toContain("!border-[#e6dccb]");
    expect(renvaniClerkSignInAppearance.elements.cardBox).toContain("max-w-[440px]");
    expect(renvaniClerkSignInAppearance.elements.formFieldInput).toContain("h-[52px]");
    expect(renvaniClerkSignInAppearance.elements.formButtonPrimary).toContain("!rounded-full");
  });

  it("does not change the shared sign-up appearance or create fake auth providers", () => {
    expect(renvaniClerkAppearance.variables.colorPrimary).toBe("#257afa");
    expect(renvaniClerkAppearance.layout.socialButtonsPlacement).toBe("bottom");
    expect(renvaniClerkSignInAppearance.layout.socialButtonsPlacement).toBe("bottom");
  });
});
