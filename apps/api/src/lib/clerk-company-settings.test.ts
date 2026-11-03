import { describe, expect, it } from "vitest";

import { readClerkOrganizationIdFromSettings } from "./clerk-company-settings.js";

describe("clerk-company-settings", () => {
  it("readClerkOrganizationIdFromSettings returns org id", () => {
    expect(
      readClerkOrganizationIdFromSettings({
        clerk: { organizationId: "org_123" }
      })
    ).toBe("org_123");
  });

  it("returns null for missing mapping", () => {
    expect(readClerkOrganizationIdFromSettings({})).toBeNull();
    expect(readClerkOrganizationIdFromSettings(null)).toBeNull();
  });
});
