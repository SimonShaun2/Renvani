import { describe, expect, it } from "vitest";

import { canManageGoogleBusinessProfile, describeConnection, describeOptIn, formatUpdatedAt } from "./google-business.utils";

const s = { optIn: false, provider: "disabled", configured: false, updatedAt: null };

describe("google business utils", () => {
  it("only owner/admin", () => {
    expect(canManageGoogleBusinessProfile("owner")).toBe(true);
    expect(canManageGoogleBusinessProfile("admin")).toBe(true);
    for (const r of ["dispatcher", "office", "technician", null]) expect(canManageGoogleBusinessProfile(r)).toBe(false);
  });
  it("is honest when the provider is not configured", () => {
    expect(describeConnection(s).key).toBe("not_connected");
    expect(describeConnection(s).detail).toMatch(/no profile details or Google reviews/);
    expect(describeConnection({ ...s, configured: true, provider: "google" }).key).toBe("connected");
  });
  it("describes opt-in and dates", () => {
    expect(describeOptIn(s)).toEqual({ label: "Not opted in", on: false });
    expect(describeOptIn({ ...s, optIn: true }).on).toBe(true);
    expect(formatUpdatedAt(null)).toBeNull();
    expect(formatUpdatedAt("bad")).toBeNull();
    expect(formatUpdatedAt("2026-10-31T18:00:00.000Z")).toMatch(/2026/);
  });
});
