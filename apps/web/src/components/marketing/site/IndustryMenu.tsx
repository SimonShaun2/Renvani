"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/** Header industry menu (Figma 177:686). <details> so it works without JS; closes on navigation and Escape. Panel is server-rendered. */
export function IndustryMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details
      ref={ref}
      data-node-id="177:686"
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current) ref.current.open = false;
      }}
    >
      <summary className="cursor-pointer list-none hover:underline">{label}</summary>
      <div className="absolute inset-x-0 top-[88px] z-30 border-t bg-white" style={{ borderColor: "var(--color-mkt-line)" }}>
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </div>
    </details>
  );
}
