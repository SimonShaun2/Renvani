import { describe, expect, it } from "vitest";
import { isSettingsNavigationActive } from "./settings-navigation-state";

describe("Settings navigation", () => {
  it("selects the saved company profile and each exact settings tab", () => {
    expect(isSettingsNavigationActive("/settings/general", "/settings/general")).toBe(true);
    expect(isSettingsNavigationActive("/settings/company", "/settings/company")).toBe(true);
    expect(isSettingsNavigationActive("/settings/users", "/settings/users")).toBe(true);
    expect(isSettingsNavigationActive("/settings/generalized", "/settings/general")).toBe(false);
  });

  it("keeps Booking selected throughout its nested settings views", () => {
    expect(isSettingsNavigationActive("/settings/booking/general", "/settings/booking/general")).toBe(true);
    expect(isSettingsNavigationActive("/settings/booking/appearance", "/settings/booking/general")).toBe(true);
    expect(isSettingsNavigationActive("/settings/booking/availability", "/settings/general")).toBe(false);
    expect(isSettingsNavigationActive("/settings/payments", "/settings/booking/general")).toBe(false);
  });
});
