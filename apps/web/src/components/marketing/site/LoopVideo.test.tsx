import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroLoop } from "./HeroLoop";
import { LoopVideo } from "./LoopVideo";
import { posterSet } from "./media-loops";

const poster = posterSet("/media/loops/test-poster", [390, 768]);

let intersectionCallback: IntersectionObserverCallback | undefined;
let reducedMotion = false;
const play = vi.fn().mockResolvedValue(undefined);
const load = vi.fn();

beforeEach(() => {
  reducedMotion = false;
  intersectionCallback = undefined;
  play.mockClear();
  load.mockClear();
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => play());
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(window.HTMLMediaElement.prototype, "load").mockImplementation(load);
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") && reducedMotion,
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
  vi.unstubAllGlobals();
});

function expectLoopAttrs(video: HTMLVideoElement) {
  expect(video.autoplay).toBe(true);
  expect(video.muted).toBe(true);
  expect(video.hasAttribute("playsinline")).toBe(true);
  expect(video.loop).toBe(true);
  expect(video.getAttribute("aria-hidden")).toBe("true");
}

describe("LoopVideo autoplay (no interaction, no pause control)", () => {
  it("attachOnLoad attaches sources at load and calls play() without scroll, pointer or viewport", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    render(<LoopVideo attachOnLoad webm="/media/loops/test.webm" mp4="/media/loops/test.mp4" poster={poster} width={960} height={720} alt="" />);
    const video = document.querySelector("video")!;
    expectLoopAttrs(video);
    expect(video.querySelectorAll("source")).toHaveLength(2);
    expect(load).toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(1);
    expect(intersectionCallback).toBeUndefined();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it("hero autoplays at load with no pause button", () => {
    render(<HeroLoop />);
    const video = document.querySelector("video")!;
    expectLoopAttrs(video);
    expect(video.querySelectorAll("source")).toHaveLength(2);
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(document.querySelector("img")!.getAttribute("loading")).toBe("eager");
  });

  it("non-eager loops attach when near the viewport", () => {
    render(<LoopVideo webm="/media/loops/test.webm" mp4="/media/loops/test.mp4" poster={poster} width={960} height={720} alt="" />);
    expect(play).not.toHaveBeenCalled();
    act(() => intersectionCallback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("logs and swallows a play() rejection", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    play.mockRejectedValueOnce(new Error("NotAllowedError"));
    render(<LoopVideo attachOnLoad webm="/media/loops/test.webm" mp4="/media/loops/test.mp4" poster={poster} width={960} height={720} alt="" />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(warn).toHaveBeenCalledWith("[LoopVideo] play() rejected", "/media/loops/test.webm", expect.any(Error));
  });

  it("reduced motion shows the still poster only, no video and no button", () => {
    reducedMotion = true;
    render(<LoopVideo attachOnLoad webm="/media/loops/test.webm" mp4="/media/loops/test.mp4" poster={poster} width={960} height={720} alt="" />);
    expect(document.querySelector("video")).toBeNull();
    expect(document.querySelector("img")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(play).not.toHaveBeenCalled();
  });
});
