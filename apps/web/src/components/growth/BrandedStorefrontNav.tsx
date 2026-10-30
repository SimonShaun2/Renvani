"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import {
  getFocusableElements,
  handleMobileNavKeydown
} from "@/src/components/growth/branded-storefront-nav.a11y";

interface BrandedStorefrontNavProps {
  bookHref: string;
  inquireHref: string;
  showReviewsLink: boolean;
  primaryClassName: string;
}

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#pricing", label: "Pricing" },
  { href: "#areas", label: "Areas we serve" }
] as const;

export function BrandedStorefrontNav({
  bookHref,
  inquireHref,
  showReviewsLink,
  primaryClassName
}: BrandedStorefrontNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef(false);
  const mobileNavId = useId().replace(/:/g, "");

  const links = showReviewsLink ? [...NAV_LINKS, { href: "#reviews", label: "Reviews" }] : [...NAV_LINKS];

  const closeMenu = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setMobileOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    setMobileOpen(true);
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        toggleRef.current?.focus();
      }

      return;
    }

    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    const focusables = getFocusableElements(panel);
    focusables[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      handleMobileNavKeydown(event, panel, () => closeMenu(true));
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen, closeMenu]);

  return (
    <>
      <nav className="hidden items-center gap-7 text-[15px] font-medium text-[#2a3360] lg:flex" aria-label="Primary">
        {links.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
        <Link href={inquireHref} className="text-[#2f7d4f] hover:underline">
          Request a quote
        </Link>
      </nav>

      <button
        ref={toggleRef}
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-lg border border-[#e6dccb] bg-white text-[#2a3360] lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls={mobileNavId}
        onClick={() => {
          if (mobileOpen) {
            closeMenu(false);
          } else {
            openMenu();
          }
        }}
      >
        <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
        {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      {mobileOpen ? (
        <nav
          ref={panelRef}
          id={mobileNavId}
          className="absolute left-0 right-0 top-full z-20 border-b border-[#e6dccb] bg-[#f7faf8] px-6 py-4 lg:hidden"
          aria-label="Mobile"
        >
          <ul className="flex flex-col gap-3 text-[15px] font-medium text-[#2a3360]">
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => closeMenu(true)}>
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <Link href={inquireHref} className="block py-1" onClick={() => closeMenu(true)}>
                Request a quote
              </Link>
            </li>
            <li>
              <Link
                href={bookHref}
                className={`inline-flex h-11 w-full items-center justify-center rounded-[10px] text-sm font-semibold text-white ${primaryClassName}`}
                onClick={() => closeMenu(true)}
              >
                Book a service
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </>
  );
}
