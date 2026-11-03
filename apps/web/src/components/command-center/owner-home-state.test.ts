import { describe, expect, it } from "vitest";
import { isKnownMetric, loopWidth, ownerPanelState, ownerSourceHref } from "./owner-home-state";
import { isOwnerHomePath, OWNER_HOME_PATH } from "@/src/lib/owner-home";
import { getActiveSidebarHref, withoutOwnerHomeAlias } from "../layout/sidebar-presentation";

describe("owner home truthful state boundaries", () => {
  it.each([
    [{ isLoading: true }, "loading"],
    [{ isPending: true }, "loading"],
    [{ isFetching: true }, "loading"],
    [{ isError: true }, "unavailable"],
    [{ isError: true, data: { count: 5 } }, "unavailable"],
    [{}, "unavailable"],
    [{ data: null }, "unavailable"],
    [{ data: { count: 0 } }, "ready"],
    [{ data: { items: [] } }, "ready"],
    [{ isFetching: true, data: { count: 2 } }, "ready"]
  ] as const)("classifies %j as %s", (query, state) => { expect(ownerPanelState(query)).toBe(state); });

  it("accepts known zero without inventing missing or malformed values", () => {
    expect(isKnownMetric(0, "count")).toBe(true);
    expect(isKnownMetric("0.00", "money")).toBe(true);
    expect(isKnownMetric(0, "percent")).toBe(true);
    expect(isKnownMetric(null, "money")).toBe(false);
    expect(isKnownMetric(undefined, "count")).toBe(false);
    expect(isKnownMetric("bad-data", "money")).toBe(false);
    expect(isKnownMetric("", "money")).toBe(false);
    expect(isKnownMetric(NaN, "percent")).toBe(false);
    expect(isKnownMetric(101, "percent")).toBe(false);
  });

  it("links only local source records", () => {
    expect(ownerSourceHref("/jobs/123")).toBe("/jobs/123");
    for (const href of ["https://elsewhere.test", "//elsewhere.test", "/\\elsewhere.test", "javascript:alert(1)", "/\n/elsewhere.test"]) expect(ownerSourceHref(href)).toBeNull();
  });

  it("rejects every ASCII control character and space without weakening source-link safety", () => {
    for (let code = 0; code <= 0x20; code += 1) {
      const character = String.fromCharCode(code);
      for (const route of [
        `${character}/jobs/123`,
        `/${character}elsewhere.test`,
        `/jobs/${character}123`,
        `/jobs/123${character}`
      ]) expect(ownerSourceHref(route)).toBeNull();
    }
    for (const route of ["/\\elsewhere.test", "/jobs\\123", "/jobs/123\\"]) {
      expect(ownerSourceHref(route)).toBeNull();
    }
    for (const route of ["/", "/jobs/123", "/jobs/hello%20world", "/customers/caf\u00e9", "/jobs?id=123#details"]) {
      expect(ownerSourceHref(route)).toBe(route);
    }
  });

  it("never creates invalid or overflowing progress bars", () => {
    expect(loopWidth(3, 10)).toBe(30);
    expect(loopWidth(12, 10)).toBe(100);
    expect(loopWidth(undefined, 10)).toBe(0);
    expect(loopWidth(3, 0)).toBe(0);
    expect(loopWidth(-1, 10)).toBe(0);
  });

  it("has one owner home without changing other role navigation", () => {
    const items = [{ href: "/dashboard" }, { href: OWNER_HOME_PATH }, { href: "/jobs" }];
    expect(withoutOwnerHomeAlias(items, "owner").map((item) => item.href)).toEqual([OWNER_HOME_PATH, "/jobs"]);
    expect(withoutOwnerHomeAlias(items, "admin").map((item) => item.href)).toEqual([OWNER_HOME_PATH, "/jobs"]);
    expect(withoutOwnerHomeAlias(items, "dispatcher")).toEqual(items);
    expect(items).toHaveLength(3);
    expect(isOwnerHomePath("/dashboard")).toBe(true);
    expect(isOwnerHomePath("/command-center")).toBe(true);
    expect(isOwnerHomePath("/command-center/approvals")).toBe(false);
    expect(getActiveSidebarHref("/dashboard", withoutOwnerHomeAlias(items, "owner"))).toBe(OWNER_HOME_PATH);
  });
});
