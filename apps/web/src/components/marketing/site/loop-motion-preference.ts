/** Shared preference: pause decorative marketing loop videos (WCAG 2.2.2). */

export const LOOP_MOTION_STORAGE_KEY = "renvani.marketing-loops-paused";

const CHANGE_EVENT = "renvani-loop-motion-change";

export function readLoopsPaused(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOOP_MOTION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeLoopsPaused(paused: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOOP_MOTION_STORAGE_KEY, paused ? "1" : "0");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { paused } }));
}

export function subscribeLoopsPaused(listener: (paused: boolean) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LOOP_MOTION_STORAGE_KEY || event.key === null) {
      listener(readLoopsPaused());
    }
  };
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ paused: boolean }>).detail;
    listener(detail?.paused ?? readLoopsPaused());
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onCustom);
  };
}
