import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT_PAGES } from "./flagship-registry";
import { HOME_WORKFLOWS } from "./home-workflows";
import { HomepageWorkflows } from "./HomepageWorkflows";
import { useWorkflowPlayback, WORKFLOW_LAST_STEP_MS, WORKFLOW_STEP_MS } from "./useWorkflowPlayback";

let intersectionCallback: IntersectionObserverCallback;
const disconnect = vi.fn();
let reducedMotion = false;
let visibility: DocumentVisibilityState = "visible";

function Harness({ sequence = "growth", count = 4 }: { sequence?: string; count?: number }) {
  const playback = useWorkflowPlayback(sequence, count);
  return (
    <div ref={playback.viewportRef} data-testid="playback" data-step={playback.step} data-playing={playback.playing} data-reduced={playback.reducedMotion}>
      <button onClick={playback.togglePaused}>Toggle pause</button>
      <button onClick={playback.replay}>Replay</button>
      <button onClick={() => playback.selectStep(2)}>Choose step</button>
    </div>
  );
}

function enterViewport(isIntersecting: boolean) {
  act(() => intersectionCallback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
}

function advance(milliseconds: number) {
  act(() => { vi.advanceTimersByTime(milliseconds); });
}

const currentStep = () => Number(screen.getByTestId("playback").getAttribute("data-step"));

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  visibility = "visible";
  disconnect.mockClear();
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
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
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { if (options?.threshold === 0.15) intersectionCallback = callback; }
    observe() {}
    unobserve() {}
    disconnect = disconnect;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("homepage workflow content", () => {
  it("offers the five flagship tours with real product destinations", () => {
    expect(HOME_WORKFLOWS.map((workflow) => workflow.id)).toEqual(["growth", "revenue", "operations", "retention", "command-center"]);
    for (const workflow of HOME_WORKFLOWS) {
      expect(PRODUCT_PAGES.some((page) => workflow.href === `/product/${page.slug}`)).toBe(true);
    }
  });

  it("preserves the requested estimate branches and field-work handoff", () => {
    const revenue = HOME_WORKFLOWS.find((workflow) => workflow.id === "revenue")!;
    expect(revenue.steps[1]!.description).toMatch(/email estimate or schedule an onsite estimate/);
    const operations = HOME_WORKFLOWS.find((workflow) => workflow.id === "operations")!;
    expect(operations.steps.map((step) => step.label)).toEqual(["Schedule", "Arrive", "Confirm work", "Do the job", "Take payment"]);
    expect(operations.steps[2]!.description).toContain("converts it to a work order");
    expect(operations.steps[3]!.description).toMatch(/track the job, check products, complete tasks and save photos/);
  });
});

describe("workflow playback", () => {
  it.each([
    { state: "visible", queued: [false, true], shouldPlay: true },
    { state: "offscreen", queued: [true, false], shouldPlay: false }
  ])("uses the latest queued visibility entry when the target ends $state", ({ queued, shouldPlay }) => {
    render(<Harness />);
    enterViewport(queued[0]!);
    const target = screen.getByTestId("playback");
    const bounds = new DOMRectReadOnly(0, 0, 100, 100);
    act(() => intersectionCallback(
      queued.map((isIntersecting, time) => ({
        target, isIntersecting, time,
        boundingClientRect: bounds,
        intersectionRatio: isIntersecting ? 1 : 0,
        intersectionRect: isIntersecting ? bounds : new DOMRectReadOnly(),
        rootBounds: bounds
      })),
      {} as IntersectionObserver
    ));
    expect(target.getAttribute("data-playing")).toBe(String(shouldPlay));
    expect(vi.getTimerCount()).toBe(shouldPlay ? 1 : 0);
    advance(WORKFLOW_STEP_MS);
    expect(currentStep()).toBe(shouldPlay ? 1 : 0);
  });

  it("runs only in view, preserves its step offscreen and loops after the final dwell", () => {
    render(<Harness />);
    advance(WORKFLOW_STEP_MS * 10);
    expect(currentStep()).toBe(0);
    enterViewport(true);
    advance(WORKFLOW_STEP_MS);
    expect(currentStep()).toBe(1);
    enterViewport(false);
    advance(WORKFLOW_STEP_MS * 10);
    expect(currentStep()).toBe(1);
    enterViewport(true);
    advance(WORKFLOW_STEP_MS);
    expect(currentStep()).toBe(2);
    advance(WORKFLOW_STEP_MS);
    expect(currentStep()).toBe(3);
    advance(WORKFLOW_LAST_STEP_MS - 1);
    expect(currentStep()).toBe(3);
    advance(1);
    expect(currentStep()).toBe(0);
  });

  it("keeps an explicit pause across product changes, while Replay restarts the chosen product", () => {
    const view = render(<Harness />);
    enterViewport(true);
    advance(WORKFLOW_STEP_MS);
    fireEvent.click(screen.getByRole("button", { name: "Toggle pause" }));
    advance(WORKFLOW_STEP_MS * 5);
    expect(currentStep()).toBe(1);
    view.rerender(<Harness sequence="operations" count={5} />);
    expect(currentStep()).toBe(0);
    expect(screen.getByTestId("playback").getAttribute("data-playing")).toBe("false");
    advance(WORKFLOW_STEP_MS * 5);
    expect(currentStep()).toBe(0);
    view.rerender(<Harness sequence="growth" count={4} />);
    expect(currentStep()).toBe(0);
    view.rerender(<Harness sequence="operations" count={5} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose step" }));
    expect(currentStep()).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(currentStep()).toBe(0);
    advance(WORKFLOW_STEP_MS);
    expect(currentStep()).toBe(1);
  });

  it("pauses in a hidden browser tab and resumes the same sequence", () => {
    render(<Harness />);
    enterViewport(true);
    advance(WORKFLOW_STEP_MS);
    visibility = "hidden";
    fireEvent(document, new Event("visibilitychange"));
    advance(WORKFLOW_STEP_MS * 5);
    expect(currentStep()).toBe(1);
    visibility = "visible";
    fireEvent(document, new Event("visibilitychange"));
    advance(WORKFLOW_STEP_MS);
    expect(currentStep()).toBe(2);
  });

  it("restarts the full first-step duration even when Replay is pressed on the first step", () => {
    render(<Harness />);
    enterViewport(true);
    advance(WORKFLOW_STEP_MS / 2);
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    advance(WORKFLOW_STEP_MS - 1);
    expect(currentStep()).toBe(0);
    advance(1);
    expect(currentStep()).toBe(1);
  });

  it("defaults reduced motion to complete, allows static manual steps and never autoplays", () => {
    reducedMotion = true;
    const view = render(<Harness />);
    enterViewport(true);
    expect(currentStep()).toBe(3);
    expect(screen.getByTestId("playback").getAttribute("data-playing")).toBe("false");
    advance(WORKFLOW_STEP_MS * 10);
    expect(currentStep()).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "Choose step" }));
    expect(currentStep()).toBe(2);
    advance(WORKFLOW_STEP_MS * 5);
    expect(currentStep()).toBe(2);
    view.rerender(<Harness sequence="command-center" count={5} />);
    expect(currentStep()).toBe(4);
    fireEvent.click(screen.getByRole("button", { name: "Choose step" }));
    expect(currentStep()).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(currentStep()).toBe(4);
  });

  it("disconnects the observer and cancels its scheduled work on unmount", () => {
    const view = render(<Harness />);
    enterViewport(true);
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("homepage workflow interaction", () => {
  it("exposes one selected panel and moves focus and selection with Arrow, Home and End keys", () => {
    render(<HomepageWorkflows />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs.slice(1).every((tab) => tab.tabIndex === -1)).toBe(true);
    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);
    expect(screen.getByRole("tabpanel", { name: "Revenue" })).toBeTruthy();
    expect(tabs[1]!.tabIndex).toBe(0);
    fireEvent.keyDown(tabs[1]!, { key: "End" });
    expect(document.activeElement).toBe(tabs[4]);
    fireEvent.keyDown(tabs[4]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0]!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[4]);
    fireEvent.keyDown(tabs[4]!, { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);
    for (const tab of tabs) expect(document.getElementById(tab.getAttribute("aria-controls")!)).toBeTruthy();
  });

  it("changes the actual Growth request UI while retaining the selected product and honors Pause and Replay", () => {
    const { container } = render(<HomepageWorkflows />);
    enterViewport(true);
    const scene = container.querySelector('[data-product="growth"]')!;
    const serviceValue = screen.getByText("Electrical repair");
    expect(serviceValue.getAttribute("data-ready")).toBe("false");
    advance(WORKFLOW_STEP_MS);
    expect(scene.getAttribute("data-step")).toBe("1");
    advance(WORKFLOW_STEP_MS);
    expect(serviceValue.getAttribute("data-ready")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Pause Growth animation" }));
    advance(WORKFLOW_STEP_MS * 5);
    expect(scene.getAttribute("data-step")).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Play Growth animation" }));
    advance(WORKFLOW_STEP_MS);
    expect(screen.getByText("Request received")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Growth" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Replay Growth animation" }));
    expect(scene.getAttribute("data-step")).toBe("0");
    expect(serviceValue.getAttribute("data-ready")).toBe("false");
  });

  it("gives every product a distinct complete scene, working manual steps and real destination", () => {
    render(<HomepageWorkflows />);
    const finalSceneText: Record<string, string> = {
      growth: "Request received",
      revenue: "Follow-up reviewed",
      operations: "Payment recorded",
      retention: "Membership or maintenance",
      "command-center": "Owner approved this example"
    };
    for (const workflow of HOME_WORKFLOWS) {
      fireEvent.click(screen.getByRole("tab", { name: workflow.name }));
      const finalStep = workflow.steps.at(-1)!;
      fireEvent.click(screen.getByRole("button", { name: finalStep.label }));
      expect(screen.getByRole("button", { name: finalStep.label }).getAttribute("aria-current")).toBe("step");
      expect(screen.getByRole("img").getAttribute("aria-label")).toContain(finalStep.title);
      expect(screen.getByText(finalSceneText[workflow.id]!)).toBeTruthy();
      expect(screen.getByRole("link", { name: `Explore ${workflow.name}` }).getAttribute("href")).toBe(workflow.href);
      expect(screen.getByRole("button", { name: `Play ${workflow.name} animation` })).toBeTruthy();
      expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    }
  });

  it("shows complete static scenes for reduced motion and supports choosing and restoring a step", () => {
    reducedMotion = true;
    const { container } = render(<HomepageWorkflows />);
    enterViewport(true);
    expect(container.querySelector('[data-product="growth"]')!.getAttribute("data-step")).toBe("3");
    expect(screen.queryByRole("button", { name: /Pause .* animation/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Set your goal" }));
    expect(container.querySelector('[data-product="growth"]')!.getAttribute("data-step")).toBe("0");
    advance(WORKFLOW_STEP_MS * 10);
    expect(container.querySelector('[data-product="growth"]')!.getAttribute("data-step")).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Show complete Growth workflow" }));
    expect(screen.getByText("Request received")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Operations" }));
    expect(screen.getByText("Payment recorded")).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
