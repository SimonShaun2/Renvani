import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/command-center" }));
vi.mock("@/src/components/marketing/site/fonts", () => ({
  geist: { variable: "geist" },
  newsreader: { variable: "newsreader" }
}));
vi.mock("./Header", () => ({ Header: () => <header>Office header</header> }));
vi.mock("./MobileNav", () => ({ MobileNav: () => <nav aria-label="Field navigation" /> }));
vi.mock("./Sidebar", () => ({
  Sidebar: ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav aria-label="Office sections">
      <a href="/jobs" onClick={(event) => { event.preventDefault(); onNavigate?.(); }}>Jobs</a>
    </nav>
  )
}));

afterEach(cleanup);

function openNavigation() {
  render(<AppShell companyName="Test shop" role="owner" userName="Test owner">Owner home</AppShell>);
  const trigger = screen.getByRole("button", { name: "Navigation" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");

  const panel = document.getElementById("office-mobile-navigation");
  if (!panel) throw new Error("Navigation should be open after activation");
  return { trigger, panel };
}

describe("office navigation dismissal", () => {
  it("closes on Escape while focus is still on the opening button", () => {
    const { trigger } = openNavigation();
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(trigger, { key: "Escape", code: "Escape" });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("office-mobile-navigation")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape from a menu link and restores focus to the button", () => {
    const { trigger, panel } = openNavigation();
    const link = within(panel).getByRole("link", { name: "Jobs" });
    link.focus();

    fireEvent.keyDown(link, { key: "Escape", code: "Escape" });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("office-mobile-navigation")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("still closes when a navigation link is selected", () => {
    const { trigger, panel } = openNavigation();

    fireEvent.click(within(panel).getByRole("link", { name: "Jobs" }));

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("office-mobile-navigation")).toBeNull();
  });
});
