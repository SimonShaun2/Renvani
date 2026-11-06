import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOOP_MOTION_STORAGE_KEY, writeLoopsPaused } from "./loop-motion-preference";
import { LoopPauseButton } from "./LoopPauseButton";
import { LoopVideo } from "./LoopVideo";
import { posterSet } from "./media-loops";

const poster = posterSet("/media/loops/test-poster", [390, 768]);

let intersectionCallback: IntersectionObserverCallback;

function enterViewport(isIntersecting: boolean) {
  act(() => {
    intersectionCallback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

const play = vi.fn().mockResolvedValue(undefined);
const pause = vi.fn();
const load = vi.fn();

beforeEach(() => {
  localStorage.clear();
  play.mockClear();
  pause.mockClear();
  load.mockClear();
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => play());
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  vi.spyOn(window.HTMLMediaElement.prototype, "load").mockImplementation(load);
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: IntersectionObserverCallback) {
        intersectionCallback = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

function renderLoop() {
  return render(
    <div>
      <LoopPauseButton label="test" hideWhenReducedMotion={false} />
      <LoopVideo webm="/media/loops/test.webm" mp4="/media/loops/test.mp4" poster={poster} width={960} height={720} alt="" />
    </div>
  );
}

describe("LoopVideo pause control (WCAG 2.2.2)", () => {
  it("pauses and plays when the control is toggled", () => {
    renderLoop();
    enterViewport(true);
    const video = document.querySelector("video")!;
    expect(video.getAttribute("aria-hidden")).toBe("true");
    expect(play).toHaveBeenCalled();

    const button = screen.getByRole("button", { name: /pause test video/i });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(localStorage.getItem(LOOP_MOTION_STORAGE_KEY)).toBe("1");
    expect(screen.getByRole("button", { name: /play test video/i }).getAttribute("aria-pressed")).toBe("true");
    expect(pause).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /play test video/i }));
    expect(localStorage.getItem(LOOP_MOTION_STORAGE_KEY)).toBe("0");
    expect(play).toHaveBeenCalled();
  });

  it("persists pause across remount", () => {
    writeLoopsPaused(true);
    const { unmount } = renderLoop();
    enterViewport(true);
    expect(screen.getByRole("button", { name: /play test video/i }).getAttribute("aria-pressed")).toBe("true");
    // Should not autoplay while preference is paused
    const playCallsBefore = play.mock.calls.length;
    enterViewport(true);
    expect(play.mock.calls.length).toBe(playCallsBefore);
    unmount();

    renderLoop();
    enterViewport(true);
    expect(screen.getByRole("button", { name: /play test video/i }).getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("video")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("supports keyboard Enter and Space on the pause control", () => {
    renderLoop();
    const button = screen.getByRole("button", { name: /pause test video/i });
    button.focus();
    fireEvent.keyDown(button, { key: "Enter", code: "Enter", charCode: 13 });
    fireEvent.click(button); // jsdom activates buttons via click from key in real browsers; click covers activation
    expect(localStorage.getItem(LOOP_MOTION_STORAGE_KEY)).toBe("1");

    const playBtn = screen.getByRole("button", { name: /play test video/i });
    fireEvent.keyDown(playBtn, { key: " ", code: "Space", charCode: 32 });
    fireEvent.click(playBtn);
    expect(localStorage.getItem(LOOP_MOTION_STORAGE_KEY)).toBe("0");
  });

  it("keeps decorative videos aria-hidden", () => {
    renderLoop();
    enterViewport(true);
    expect(document.querySelector("video")?.getAttribute("aria-hidden")).toBe("true");
  });
});
