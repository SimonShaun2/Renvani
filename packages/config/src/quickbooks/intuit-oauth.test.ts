import { describe, expect, it } from "vitest";

import { readQboRuntimeConfig } from "../qbo-env.js";
import { buildQboOAuthState, verifyQboOAuthState } from "./intuit-oauth.js";

describe("QuickBooks OAuth state", () => {
  it("round-trips company id with HMAC state", () => {
    const state = buildQboOAuthState("00000000-0000-4000-8000-000000000099", "test-secret");
    const companyId = verifyQboOAuthState(state, "test-secret");
    expect(companyId).toBe("00000000-0000-4000-8000-000000000099");
  });

  it("reads sandbox runtime config from env", () => {
    const config = readQboRuntimeConfig();
    expect(config?.environment).toBe("sandbox");
  });
});
