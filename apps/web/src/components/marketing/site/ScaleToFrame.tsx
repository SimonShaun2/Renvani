"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders a fixed-width Figma frame (default 1440px) scaled down to the container width with CSS `zoom`,
 * so layout height follows the scaled content (no blank space) and nothing overflows sideways.
 * Never scales up beyond 1.
 */
export function ScaleToFrame({ width = 1440, children }: { width?: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / width));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={outer} className="w-full overflow-x-clip" data-scale-to-frame={width}>
      <div style={{ width, zoom: scale, marginInline: "auto" }}>{children}</div>
    </div>
  );
}
