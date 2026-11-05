"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

const HEADER_MENU_GROUP = "marketing-header";

/**
 * Header menu disclosure (product 177:640, industry 177:686, mobile 177:737). Native <details> opens without JS,
 * and a shared name keeps the menus exclusive. With JS, sibling toggles and outside interactions close the menu,
 * Escape and any "Close menu" button ([data-menu-close]) return focus to its toggle, and links or route changes close it.
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
  const close = useCallback((focus: boolean) => {
    if (!ref.current) return;
    ref.current.open = false;
    setOpen(false);
    if (focus) ref.current.querySelector("summary")?.focus();
  }, []);

  useEffect(() => close(false), [pathname, close]);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const ownerDocument = details.ownerDocument;
    const onToggle = (event: Event) => {
      const target = event.target;
      // Also synchronize React state and support browsers without native details grouping.
      if (target instanceof HTMLDetailsElement && target !== details && target.getAttribute("name") === HEADER_MENU_GROUP && target.open) {
        close(false);
      }
    };
    const onOutsideInteraction = (event: Event) => {
      if (details.open && event.target instanceof Node && !details.contains(event.target)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && details.open) {
        event.preventDefault();
        close(true);
      }
    };

    // Toggle does not bubble. Capture observes sibling menus before React handles their state.
    ownerDocument.addEventListener("toggle", onToggle, true);
    ownerDocument.addEventListener("pointerdown", onOutsideInteraction, true);
    ownerDocument.addEventListener("click", onOutsideInteraction, true);
    ownerDocument.addEventListener("keydown", onKeyDown);
    return () => {
      ownerDocument.removeEventListener("toggle", onToggle, true);
      ownerDocument.removeEventListener("pointerdown", onOutsideInteraction, true);
      ownerDocument.removeEventListener("click", onOutsideInteraction, true);
      ownerDocument.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  return (
    <details
      ref={ref}
      name={HEADER_MENU_GROUP}
      data-node-id={nodeId}
      className={className}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      onClick={(e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
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
