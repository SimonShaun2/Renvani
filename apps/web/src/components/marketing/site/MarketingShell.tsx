import Link from "next/link";
import type { ReactNode } from "react";

import { geist, newsreader } from "./fonts";
import { FigmaNode } from "./FigmaNode";
import { IndustryMenu } from "./IndustryMenu";
import { INDUSTRY_TREES } from "./industry-visuals";
import { ProductsMenu } from "./ProductsMenu";
import { SITE_FOOTER, SITE_NAV } from "./site-config";
import styles from "./site.module.css";

const serif = { fontFamily: "var(--font-mkt-serif), Georgia, serif", fontStyle: "italic" } as const;

/** Shared marketing nav (200:521) and footer (200:530; tablet 768 per 253:6918 / 253:6961, md to below lg only). Server component. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${geist.variable} ${newsreader.variable} min-h-screen`}
      style={{ background: "var(--color-mkt-cream)", color: "var(--color-mkt-ink)", fontFamily: "var(--font-mkt-sans), system-ui, sans-serif" }}
    >
      <header data-node-id="203:4394" className="relative mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-10 px-6 lg:h-[88px] lg:px-16">
        <Link href="/" className="text-[26px] lg:text-[30px]" style={serif}>
          Renvani
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-10 text-[14px] font-medium lg:flex" style={{ color: "var(--color-mkt-ink2)" }}>
          {SITE_NAV.links.map((l) =>
            l.href === "/product" ? (
              <ProductsMenu key={l.label} label={l.label} />
            ) : l.href === "/industries" ? (
              <IndustryMenu key={l.label} label={l.label}>
                <FigmaNode node={INDUSTRY_TREES.menu!.desktop} className="w-full" />
              </IndustryMenu>
            ) : (
              <Link key={l.label} href={l.href} className="hover:underline">
                {l.label}
              </Link>
            )
          )}
        </nav>
        <div className="hidden items-center gap-4 lg:flex">
          <Link href={SITE_NAV.signIn.href} className="text-[14px] font-medium" style={{ color: "var(--color-mkt-ink2)" }}>
            {SITE_NAV.signIn.label}
          </Link>
          <Link
            href={SITE_NAV.cta.href}
            className={`${styles.press} inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px] font-medium`}
            style={{ background: "var(--color-mkt-ink)", color: "var(--color-mkt-cream)" }}
          >
            {SITE_NAV.cta.label}
          </Link>
        </div>
        <details data-node-id="177:737" className="relative lg:hidden">
          {/* Hamburger icon per 253:6782 / 200:535 (icon from the frame's layer). */}
          <summary aria-label="Menu" className="flex size-11 cursor-pointer list-none items-center justify-center">
            <img src="/marketing/home/tablet/icon-menu-fb31084f.svg" alt="" width={24} height={24} />
          </summary>
          <nav aria-label="Mobile" className="absolute right-0 z-20 mt-2 flex w-64 flex-col gap-1 rounded-2xl border p-3" style={{ background: "var(--color-mkt-cream)", borderColor: "var(--color-mkt-line)" }}>
            {[...SITE_NAV.links, SITE_NAV.signIn].map((l) => (
              <Link key={l.label} href={l.href} className="flex min-h-[44px] items-center px-2 text-[15px]">
                {l.label}
              </Link>
            ))}
            <Link href={SITE_NAV.cta.href} className="mt-2 flex min-h-[44px] items-center justify-center rounded-full text-[15px] font-medium" style={{ background: "var(--color-mkt-ink)", color: "var(--color-mkt-cream)" }}>
              {SITE_NAV.cta.label}
            </Link>
          </nav>
        </details>
      </header>
      <main>{children}</main>
      <footer data-node-id="203:4576" className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-6 md:grid md:grid-cols-[484px_204px] md:gap-x-4 md:gap-y-6 md:p-8 lg:flex lg:flex-row lg:flex-nowrap lg:items-start lg:justify-start lg:gap-6 lg:px-16 lg:py-16">
        <p className="text-[28px] md:order-1 md:leading-[1.4] lg:w-[350px] lg:leading-[inherit]" style={serif}>
          Renvani
        </p>
        <nav aria-label="Footer" className="flex flex-col gap-4 md:order-3 md:col-span-2 md:w-[704px] md:flex-row md:text-[14px] md:leading-[1.4] text-[12px] lg:order-2 lg:col-auto lg:w-[510px] lg:flex-wrap lg:text-[12px] lg:leading-[inherit]" style={{ color: "var(--color-mkt-ink2)" }}>
          {SITE_FOOTER.links.map((l) => (
            <Link key={l.label} href={l.href} className="min-w-[112px] md:w-[164px] md:shrink-0 lg:w-auto lg:shrink">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-[11px] md:order-2 md:text-[12px] md:leading-[1.4] lg:order-3 lg:text-[11px] lg:leading-[inherit]" style={{ color: "var(--color-mkt-ink2)" }}>
          {SITE_FOOTER.copyright}
        </p>
      </footer>
    </div>
  );
}
