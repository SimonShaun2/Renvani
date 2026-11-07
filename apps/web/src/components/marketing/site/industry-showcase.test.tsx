import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IndustryShowcase } from "./IndustryShowcase";
import { LOOP_MOTION_STORAGE_KEY } from "./loop-motion-preference";

let reducedMotion = false;

beforeEach(() => {
  reducedMotion = false;
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
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
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
  it("offers six plain whole-card destinations with a muted trade loop and no chips or EXAMPLE tags", () => {
    const { container } = render(<IndustryShowcase />);
    const destinations = [
      ["HVAC & Refrigeration", "hvac", "Keep comfort on schedule."],
      ["Plumbing", "plumbing", "Keep good jobs flowing."],
      ["Electrical", "electrical", "Every detail. One clear job."],
      ["Appliance Repair", "appliance-repair", "From diagnosis to done."],
      ["Pest Control", "pest-control", "Make the next visit easy."],
      ["Tree Care", "tree-care", "Keep the whole crew in sync."]
    ] as const;

    expect(screen.getByRole("heading", { level: 2, name: "Your trade. Your next good job." })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.getByRole("link", { name: "All industries" }).getAttribute("href")).toBe("/industries");
    for (const [name, slug, outcome] of destinations) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(`/industries/${slug}`);
      expect(within(link).getByRole("heading", { level: 3, name })).toBeTruthy();
      expect(within(link).getByText(outcome)).toBeTruthy();
      const video = link.querySelector("video");
      expect(video).toBeTruthy();
      expect(video!.muted).toBe(true);
      expect(link.querySelector("img")!.getAttribute("alt")).toBe("");
    }
    expect(container.textContent).not.toMatch(/EXAMPLE/);
    expect(container.querySelectorAll("[data-mini-workflow], [data-chip-icon]")).toHaveLength(0);
    expect(container.querySelector("a a, a button")).toBeNull();
  });

  it("exposes one pause/play control outside card links that persists", () => {
    const { container } = render(<IndustryShowcase />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const pause = screen.getByRole("button", { name: /pause trade section/i });
    expect(pause.closest("a")).toBeNull();
    expect(pause.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector("[data-industry-gallery]")!.getAttribute("data-playing")).toBe("true");

    fireEvent.click(pause);
    expect(localStorage.getItem(LOOP_MOTION_STORAGE_KEY)).toBe("1");
    expect(screen.getByRole("button", { name: /play trade section/i }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("[data-industry-gallery]")!.getAttribute("data-playing")).toBe("false");
  });

  it("hides the pause control under reduced motion", () => {
    reducedMotion = true;
    const { container } = render(<IndustryShowcase />);
    expect(screen.queryByRole("button", { name: /trade section/i })).toBeNull();
    expect(container.querySelector("[data-industry-gallery]")!.getAttribute("data-playing")).toBe("false");
  });
});
