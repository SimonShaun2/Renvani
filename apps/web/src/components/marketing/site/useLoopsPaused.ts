"use client";

import { useCallback, useEffect, useState } from "react";

import { readLoopsPaused, subscribeLoopsPaused, writeLoopsPaused } from "./loop-motion-preference";

/** Shared pause preference for marketing LoopVideo instances. */
export function useLoopsPaused(): [boolean, (paused: boolean) => void] {
  const [paused, setPausedState] = useState(false);

  useEffect(() => {
    setPausedState(readLoopsPaused());
    return subscribeLoopsPaused(setPausedState);
  }, []);

  const setPaused = useCallback((next: boolean) => {
    writeLoopsPaused(next);
    setPausedState(next);
  }, []);

  return [paused, setPaused];
}
