"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Header menu disclosure (product 177:640, industry 177:686, mobile 177:737). A <details> element so it opens without JS;
 * with JS: aria-expanded/aria-controls on the toggle, Escape closes and returns focus to the toggle, any "Close menu"
 * button inside ([data-menu-close]) closes, and following a link (or any route change) closes the menu.
 */
export function HeaderDisclosure({
  nodeId,
  className,
  summaryClassName,
  summary,
  summaryLabel,
  panelClassName,
  children
}: {
  nodeId: string;
  className?: string;
  summaryClassName?: string;
  summary: ReactNode;
  summaryLabel?: { open: string; closed: string };
  panelClassName: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const pathname = usePathname();
  const close = (focus: boolean) => {
    if (!ref.current) return;
    ref.current.open = false;
    setOpen(false);
    if (focus) ref.current.querySelector("summary")?.focus();
  };
  useEffect(() => close(false), [pathname]);
  return (
    <details
      ref={ref}
      data-node-id={nodeId}
      className={className}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current?.open) {
          e.preventDefault();
          close(true);
        }
      }}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("[data-menu-close]")) close(true);
        else if (t.closest("a")) close(false);
      }}
    >
      <summary aria-expanded={open} aria-controls={id} aria-label={summaryLabel ? (open ? summaryLabel.open : summaryLabel.closed) : undefined} className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${summaryClassName ?? ""}`}>
        {summary}
      </summary>
      <div id={id} className={panelClassName}>
        {children}
      </div>
    </details>
  );
}
