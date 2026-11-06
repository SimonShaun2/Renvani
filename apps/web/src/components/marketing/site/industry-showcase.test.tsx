import { statSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IndustryShowcase } from "./IndustryShowcase";
import { WORKFLOW_STEP_MS } from "./useWorkflowPlayback";

let intersectionCallback: IntersectionObserverCallback;
let observedThreshold: IntersectionObserverInit["threshold"];
let reducedMotion = false;
const observe = vi.fn();

function setInView(isIntersecting: boolean) {
  act(() => intersectionCallback([{ isIntersecting, intersectionRatio: isIntersecting ? 0.01 : 0 } as IntersectionObserverEntry], {} as IntersectionObserver));
}

function advance(milliseconds: number) {
  act(() => { vi.advanceTimersByTime(milliseconds); });
}

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  observe.mockClear();
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
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      if (options?.threshold === 0) {
        intersectionCallback = callback;
        observedThreshold = options.threshold;
      }
    }
    observe = observe;
    unobserve() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("homepage industry gallery", () => {
  it("offers six named whole-card destinations and the full directory, using the approved local photos", () => {
    const { container } = render(<IndustryShowcase />);
    const destinations = [
      ["HVAC & Refrigeration", "hvac"],
      ["Plumbing", "plumbing"],
      ["Electrical", "electrical"],
      ["Appliance Repair", "appliance-repair"],
      ["Pest Control", "pest-control"],
      ["Tree Care", "tree-care"]
    ] as const;

    expect(screen.getByRole("heading", { level: 2, name: "Your trade. Your next good job." })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.getByRole("link", { name: "All industries" }).getAttribute("href")).toBe("/industries");
    for (const [name, slug] of destinations) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(`/industries/${slug}`);
      expect(within(link).getByRole("heading", { level: 3, name })).toBeTruthy();
      const photo = link.querySelector<HTMLImageElement>("img");
      expect(photo).toBeTruthy();
      const src = decodeURIComponent(photo!.getAttribute("src") || "");
      expect(src).toMatch(/trade-|industry|illustrative|media\/loops/);
      expect(photo!.getAttribute("alt")).toBe("");
      expect(link.querySelector('[aria-hidden="true"] [data-mini-workflow]')).toBeTruthy();
    }
    expect(container.querySelector("a a, a button")).toBeNull();
    expect(screen.getByRole("button", { name: "Pause animations" }).closest("a")).toBeNull();

    const vectorImages = [...container.querySelectorAll<HTMLImageElement>('img[src$=".svg"]')];
    expect(new Set(vectorImages.map((image) => image.getAttribute("src"))).size).toBe(4);
    for (const image of vectorImages) {
      expect(statSync(join(process.cwd(), "public", image.getAttribute("src")!)).size).toBeGreaterThan(0);
      const dimension = image.getAttribute("src")!.includes("dispatch") ? "8" : "15";
      expect(image.getAttribute("width")).toBe(dimension);
      expect(image.getAttribute("height")).toBe(dimension);
    }
  });

  it("advances six distinct mini-operations with one Pause control even when a small part of the mobile gallery is visible", () => {
    const { container } = render(<IndustryShowcase />);
    const grid = container.querySelector("#home-industry-cards")!;
    const miniUIs = [...container.querySelectorAll("[data-mini-workflow]")];
    expect(miniUIs.map((miniUI) => miniUI.getAttribute("data-mini-workflow"))).toEqual(["schedule", "dispatch", "tasks", "progress", "return-visit", "crew"]);
    expect(observedThreshold).toBe(0);
    expect(observe).toHaveBeenCalledWith(grid);
    expect(vi.getTimerCount()).toBe(0);

    setInView(true);
    expect(vi.getTimerCount()).toBe(1);
    advance(WORKFLOW_STEP_MS);
    expect(miniUIs.every((miniUI) => miniUI.getAttribute("data-phase") === "1")).toBe(true);
    expect(container.querySelector('[data-mini-workflow="schedule"] [data-selected="true"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-mini-workflow="tasks"] [data-ready="true"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-mini-workflow="dispatch"] [data-ready="true"]')).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Pause animations" }));
    advance(WORKFLOW_STEP_MS * 5);
    expect(grid.getAttribute("data-phase")).toBe("1");
    expect(container.querySelector("[data-industry-gallery]")!.getAttribute("data-playing")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Play animations" }));
    advance(WORKFLOW_STEP_MS);
    expect(grid.getAttribute("data-phase")).toBe("2");
    expect([...container.querySelectorAll('[data-active="true"]')].map((status) => status.textContent)).toEqual([
      "Visit confirmed", "Dispatch ready", "Job checks recorded", "Job photos saved", "Return visit planned", "Crew plan ready"
    ]);

    setInView(false);
    advance(WORKFLOW_STEP_MS * 5);
    expect(grid.getAttribute("data-phase")).toBe("2");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows the six final static examples with reduced motion and no unnecessary playback control or scheduled work", () => {
    reducedMotion = true;
    const { container } = render(<IndustryShowcase />);
    setInView(true);
    expect(screen.queryByRole("button", { name: /animations/ })).toBeNull();
    expect(container.querySelector("[data-industry-gallery]")!.getAttribute("data-playing")).toBe("false");
    expect(container.querySelectorAll('[data-mini-workflow][data-phase="2"]')).toHaveLength(6);
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(6);
    expect(vi.getTimerCount()).toBe(0);
    advance(WORKFLOW_STEP_MS * 10);
    expect(container.querySelector("#home-industry-cards")!.getAttribute("data-phase")).toBe("2");
  });
});
