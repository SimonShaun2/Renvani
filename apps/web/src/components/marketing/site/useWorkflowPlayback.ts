"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../visuals/motion";

export const WORKFLOW_STEP_MS = 2600;
export const WORKFLOW_LAST_STEP_MS = 4400;

/** Playback state for an illustrative sequence only. No product or customer actions are performed. */
export function useWorkflowPlayback(sequenceKey: string, stepCount: number) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ key: sequenceKey, index: 0, manual: false });
  const [paused, setPaused] = useState(false);
  const [replayToken, setReplayToken] = useState(0);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const reducedMotion = usePrefersReducedMotion();
  const lastStep = Math.max(0, stepCount - 1);
  const sequenceStep = position.key === sequenceKey ? Math.min(position.index, lastStep) : 0;
  const hasManualStep = position.key === sequenceKey && position.manual;
  const step = reducedMotion && !hasManualStep ? lastStep : sequenceStep;
  const playing = !paused && !reducedMotion && inView && pageVisible;

  useEffect(() => {
    setPosition((current) => current.key === sequenceKey ? current : { key: sequenceKey, index: 0, manual: false });
  }, [sequenceKey]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.15 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!playing || stepCount < 2) return;
    const timer = window.setTimeout(() => {
      setPosition({ key: sequenceKey, index: (sequenceStep + 1) % stepCount, manual: false });
    }, sequenceStep === lastStep ? WORKFLOW_LAST_STEP_MS : WORKFLOW_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [lastStep, playing, replayToken, sequenceKey, sequenceStep, stepCount]);

  const replay = () => {
    setPosition({ key: sequenceKey, index: 0, manual: false });
    setReplayToken((current) => current + 1);
    setPaused(false);
  };

  const selectStep = (index: number) => {
    if (index < 0 || index > lastStep) return;
    setPosition({ key: sequenceKey, index, manual: true });
    setPaused(true);
  };

  return { viewportRef, step, paused, playing, reducedMotion, replayToken, replay, selectStep, togglePaused: () => setPaused((current) => !current) };
}
