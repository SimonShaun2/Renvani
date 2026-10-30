import Link from "next/link";
import type { ReactNode } from "react";

import { geist, newsreader } from "./fonts";
import { FigmaNode } from "./FigmaNode";
import { IndustryMenu } from "./IndustryMenu";
import { INDUSTRY_TREES } from "./industry-visuals";
import { HeaderDisclosure } from "./HeaderDisclosure";
import { ProductsMenuPanel } from "./ProductsMenuPanel";
import { SITE_FOOTER, SITE_NAV } from "./site-config";
import styles from "./site.module.css";

const serif = { fontFamily: "var(--font-mkt-serif), Georgia, serif", fontStyle: "italic" } as const;

/** Shared marketing nav (200:521) and footer (200:530). Server component. */
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
              <HeaderDisclosure key={l.label} nodeId="177:640" summary={l.label} summaryClassName="hover:underline" panelClassName="absolute inset-x-0 top-[88px] z-30">
                <ProductsMenuPanel variant="desktop" />
              </HeaderDisclosure>
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
        {/* Mobile + tablet menu (177:737; product menu 226:7296). Hamburger per 253:6782 / 200:535. */}
        <HeaderDisclosure
          nodeId="177:737"
          className="lg:hidden"
          summaryClassName="flex size-11 items-center justify-center"
          summaryLabel={{ open: "Close menu", closed: "Open menu" }}
          summary={<img src="/marketing/home/tablet/icon-menu-fb31084f.svg" alt="" width={24} height={24} />}
          panelClassName="absolute inset-x-0 top-[76px] z-30 max-h-[calc(100dvh-76px)] overflow-y-auto"
        >
          <nav aria-label="Mobile">
            <ProductsMenuPanel variant="mobile" />
          </nav>
        </HeaderDisclosure>
      </header>
      <main>{children}</main>
      <footer data-node-id="203:4576" className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-6 md:flex-row md:flex-wrap md:items-start md:justify-between md:p-8 lg:flex-nowrap lg:justify-start lg:px-16 lg:py-16">
        <p className="text-[28px] md:order-1 lg:w-[350px]" style={serif}>
          Renvani
        </p>
        <nav aria-label="Footer" className="flex flex-col gap-4 md:order-3 md:w-full md:flex-row md:flex-wrap text-[12px] lg:order-2 lg:w-[510px]" style={{ color: "var(--color-mkt-ink2)" }}>
          {SITE_FOOTER.links.map((l) => (
            <Link key={l.label} href={l.href} className="min-w-[112px]">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-[11px] md:order-2 lg:order-3" style={{ color: "var(--color-mkt-ink2)" }}>
          {SITE_FOOTER.copyright}
        </p>
      </footer>
    </div>
  );
}
