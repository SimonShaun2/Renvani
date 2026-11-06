import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IndustryShowcase, TRADE_CARD_EXAMPLES } from "./IndustryShowcase";
import { LOOP_MOTION_STORAGE_KEY } from "./loop-motion-preference";

const observe = vi.fn();
let reducedMotion = false;

beforeEach(() => {
  reducedMotion = false;
  observe.mockClear();
  localStorage.clear();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("prefers-reduced-motion") && reducedMotion,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true)
  }));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = observe;
      unobserve() {}
      disconnect() {}
    }
  );
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("homepage industry gallery", () => {
  it("offers six named whole-card destinations with standalone trade chips and icons", () => {
    const { container } = render(<IndustryShowcase />);
    const destinations = [
      ["HVAC & Refrigeration", "hvac", "Spring tune-ups · 18 booked", "RETENTION · EXAMPLE"],
      ["Plumbing", "plumbing", "Water heater estimate · Option B approved", "REVENUE · EXAMPLE"],
      ["Electrical", "electrical", "Panel upgrade · permit checklist ready", "OPERATIONS · EXAMPLE"],
      ["Appliance Repair", "appliance-repair", "Part on order · customer notified", "OPERATIONS · EXAMPLE"],
      ["Pest Control", "pest-control", "Quarterly service · auto-scheduled", "RETENTION · EXAMPLE"],
      ["Tree Care", "tree-care", "Storm cleanup request · from Google", "GROWTH · EXAMPLE"]
    ] as const;

    expect(screen.getByRole("heading", { level: 2, name: "Your trade. Your next good job." })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.getByRole("link", { name: "All industries" }).getAttribute("href")).toBe("/industries");
    expect(TRADE_CARD_EXAMPLES).toHaveLength(6);

    for (const [name, slug, chip, qualifier] of destinations) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(`/industries/${slug}`);
      expect(within(link).getByRole("heading", { level: 3, name })).toBeTruthy();
      expect(within(link).getByText(chip)).toBeTruthy();
      expect(within(link).getByText(qualifier)).toBeTruthy();
      expect(link.querySelector(`[data-chip-icon="${slug}"]`)).toBeTruthy();
      const photo = link.querySelector<HTMLImageElement>("img");
      expect(photo).toBeTruthy();
      expect(photo!.getAttribute("alt")).toBe("");
    }

    expect(container.querySelector("a a, a button")).toBeNull();
    expect(container.querySelectorAll("[data-mini-workflow]")).toHaveLength(0);
  });

  it("exposes one pause/play control outside card links that persists and pauses section motion", () => {
    const { container } = render(<IndustryShowcase />);
    const pause = screen.getByRole("button", { name: /pause trade section/i });
    expect(pause.closest("a")).toBeNull();
    expect(screen.queryByRole("button", { name: /pause animations/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /pause video/i })).toBeNull();
    expect(pause.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector("[data-industry-gallery]")!.getAttribute("data-playing")).toBe("true");

    fireEvent.click(pause);
    expect(localStorage.getItem(LOOP_MOTION_STORAGE_KEY)).toBe("1");
    expect(screen.getByRole("button", { name: /play trade section/i }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("[data-industry-gallery]")!.getAttribute("data-playing")).toBe("false");

    cleanup();
    const again = render(<IndustryShowcase />);
    expect(screen.getByRole("button", { name: /play trade section/i }).getAttribute("aria-pressed")).toBe("true");
    expect(again.container.querySelector("[data-industry-gallery]")!.getAttribute("data-playing")).toBe("false");
  });

  it("hides the pause control under reduced motion", () => {
    reducedMotion = true;
    const { container } = render(<IndustryShowcase />);
    expect(screen.queryByRole("button", { name: /trade section/i })).toBeNull();
    expect(container.querySelector("[data-industry-gallery]")!.getAttribute("data-playing")).toBe("false");
  });
});
