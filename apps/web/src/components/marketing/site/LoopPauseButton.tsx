"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { useLoopsPaused } from "./useLoopsPaused";

export type LoopPauseButtonProps = {
  /** Short name for aria-label, e.g. "hero", "Growth product", "trade card". */
  label: string;
  className?: string | undefined;
  /** When true, hide the control under reduced motion (nothing to pause). */
  hideWhenReducedMotion?: boolean | undefined;
};

/**
 * Keyboard-operable pause/play for decorative marketing loops.
 * Preference is shared via localStorage across sections, reloads, and tabs.
 */
export function LoopPauseButton({ label, className = "", hideWhenReducedMotion = true }: LoopPauseButtonProps) {
  const [paused, setPaused] = useLoopsPaused();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (hideWhenReducedMotion && reducedMotion) return null;

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-full border border-[var(--color-mkt-ink)] bg-white/95 text-[var(--color-mkt-ink)] text-[14px] font-medium shadow-sm transition hover:bg-[var(--color-mkt-cream)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#b67500] ${className}`}
      aria-pressed={paused}
      aria-label={paused ? `Play ${label} video` : `Pause ${label} video`}
      onClick={() => setPaused(!paused)}
    >
      {paused ? <Play size={16} aria-hidden="true" className="ml-0.5" /> : <Pause size={16} aria-hidden="true" />}
      <span>{paused ? "Play video" : "Pause video"}</span>
    </button>
  );
}
