"use client";

import { useEffect, useState } from "react";

export const EASE = "cubic-bezier(0.2,0,0,1)";
export const COUNTER_EASE = (t: number) => {
  // cubic-bezier(0.33,1,0.68,1) ~ easeOutCubic
  return 1 - Math.pow(1 - t, 3);
};

/** Slide distances (px): 8px panel, 10px cards. */
export const SLIDE = { panel: 8, card: 10 } as const;

export const TIMING = {
  panel: { delay: 0, duration: 320 },
  ring: { delay: 240, duration: 240 },
  cardA: { delay: 400, duration: 300 },
  cardB: { delay: 520, duration: 300 },
  counter: { delay: 640, duration: 300 },
  tick: { delay: 700, duration: 600 },
  cursor: { delay: 900, duration: 300 },
  press: { duration: 160 },
  chip: { duration: 200 },
  reducedFade: 200
} as const;

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

export const usePrefersReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");
/** Touch / small screens: no cursor glide. */
export const useIsCoarsePointer = () => useMedia("(hover: none), (pointer: coarse), (max-width: 767px)");

/** Plays once when 30% of the element is in view. */
export function useInViewOnce<T extends Element>(ref: React.RefObject<T | null>, threshold = 0.3): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, inView]);
  return inView;
}

export type LayerKey = "panel" | "ring" | "cardA" | "cardB" | "counter";

/** Pure style builder so reduced-motion behaviour is testable. */
export function layerStyle(
  layer: LayerKey,
  opts: { shown: boolean; reduced: boolean; animating: boolean }
): React.CSSProperties {
  const { shown, reduced, animating } = opts;
  if (reduced) {
    return { opacity: shown ? 1 : 0, transition: `opacity ${TIMING.reducedFade}ms linear` };
  }
  const t = TIMING[layer];
  const hidden =
    layer === "panel"
      ? `translateY(${SLIDE.panel}px) scale(0.98)`
      : layer === "ring"
        ? "scale(1.02)"
        : `translateY(${SLIDE.card}px)`;
  return {
    opacity: shown ? 1 : 0,
    transform: shown ? "none" : hidden,
    transition: `opacity ${t.duration}ms ${EASE} ${t.delay}ms, transform ${t.duration}ms ${EASE} ${t.delay}ms`,
    willChange: animating ? "opacity, transform" : undefined
  };
}
