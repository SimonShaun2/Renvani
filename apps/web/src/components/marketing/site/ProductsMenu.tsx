"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { MaybeLink } from "./MaybeLink";
import { PRODUCTS_MENU } from "./site-config";

/** Header products menu (Figma 177:640). <details> so it works without JS; closes on navigation and Escape. */
export function ProductsMenu({ label }: { label: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <details
      ref={ref}
      data-node-id="177:640"
      className="group"
      onKeyDown={(e) => {
        if (e.key === "Escape" && ref.current) ref.current.open = false;
      }}
    >
      <summary className="cursor-pointer list-none hover:underline">{label}</summary>
      <div className="absolute inset-x-0 top-[88px] z-30 border-t" style={{ background: "var(--color-mkt-cream)", borderColor: "var(--color-mkt-line)" }}>
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-16 pb-12 pt-10">
          <div className="flex items-center justify-between">
            <p className="text-[32px] font-semibold tracking-[-0.8px]" style={{ color: "var(--color-mkt-ink)" }}>{PRODUCTS_MENU.headline}</p>
            <Link href={PRODUCTS_MENU.all.href} className="inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px]" style={{ background: "var(--color-mkt-ink)", color: "var(--color-mkt-cream)" }}>
              {PRODUCTS_MENU.all.label}
            </Link>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {PRODUCTS_MENU.groups.map((g) => (
              <div key={g.title} className="flex flex-col gap-2">
                <Link href={g.href} className="mb-1 flex items-center justify-between text-[20px] font-semibold" style={{ color: "var(--color-mkt-ink)" }}>
                  {g.title}
                  <span aria-hidden="true">→</span>
                </Link>
                {g.items.map((i) => (
                  <MaybeLink key={i.label} href={i.href} className="flex min-h-[38px] items-center justify-between rounded-lg bg-white px-2 py-2 text-[13px]" style={{ color: "var(--color-mkt-ink)" }}>
                    {i.label}
                    <span aria-hidden="true">→</span>
                  </MaybeLink>
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href={PRODUCTS_MENU.cta.href} className="inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px]" style={{ background: "var(--color-mkt-amber)", color: "var(--color-mkt-ink)" }}>
              {PRODUCTS_MENU.cta.label}
            </Link>
          </div>
        </div>
      </div>
    </details>
  );
}
