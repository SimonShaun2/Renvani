import { describe, expect, it } from "vitest";

import { isClerkAuthParallelJwtEnabled } from "@fsm/config/feature-flags";

import { CLERK_ROLE_CLAIM, extractClerkRoleClaim, parseClerkAuthorizedParties } from "./clerk-auth.js";

describe("clerk-auth config", () => {
  it("enables Clerk parallel auth only on staging", () => {
    expect(isClerkAuthParallelJwtEnabled({ RENVANI_DEPLOYMENT_TIER: "staging" })).toBe(true);
    expect(isClerkAuthParallelJwtEnabled({ RENVANI_DEPLOYMENT_TIER: "production" })).toBe(false);
    expect(isClerkAuthParallelJwtEnabled({})).toBe(false);
  });

  it("parses authorized parties from a comma list", () => {
    expect(parseClerkAuthorizedParties(" https://a.example.com/, https://b.example.com ,")).toEqual([
      "https://a.example.com",
      "https://b.example.com"
    ]);
    expect(parseClerkAuthorizedParties("")).toEqual([]);
  });

  it("reads only valid role claims", () => {
    expect(CLERK_ROLE_CLAIM).toBe("renvani_role");
    expect(extractClerkRoleClaim({ renvani_role: "dispatcher" })).toBe("dispatcher");
    expect(extractClerkRoleClaim({ renvani_role: "superuser" })).toBeNull();
    expect(extractClerkRoleClaim({})).toBeNull();
  });
});
