import { describe, expect, it } from "vitest";
import { getActiveSidebarHref, groupSidebarItems } from "./sidebar-presentation";

describe("sidebar presentation", () => {
  const destinations = ["/dashboard", "/dispatch", "/jobs", "/command-center", "/booking-requests", "/growth/growth-check", "/settings"].map((href) => ({ href }));
  it("keeps every supplied destination without inventing role access", () => {
    expect(groupSidebarItems(destinations).flatMap((group) => group.items.map((item) => item.href)).sort()).toEqual(destinations.map((item) => item.href).sort());
  });
  it("places Command Center first without mutating the role definition", () => {
    const before = destinations.map((item) => item.href);
    expect(groupSidebarItems(destinations)[0]?.items[0]?.href).toBe("/command-center");
    expect(destinations.map((item) => item.href)).toEqual(before);
  });
  it("uses the most-specific active destination", () => {
    expect(getActiveSidebarHref("/command-center/approvals/42", [{ href: "/command-center" }, { href: "/command-center/approvals" }])).toBe("/command-center/approvals");
  });
  it("does not match unrelated route prefixes", () => {
    expect(getActiveSidebarHref("/jobs-archive", destinations)).toBeNull();
  });
  it("does not manufacture groups for an empty navigation", () => {
    expect(groupSidebarItems([])).toEqual([]);
  });
});
