import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { geist, inter, newsreader } from "./fonts";
import { FigmaNode } from "./FigmaNode";
import { IndustryMenu } from "./IndustryMenu";
import { INDUSTRY_TREES } from "./industry-visuals";
import { HeaderDisclosure } from "./HeaderDisclosure";
import { ProductsMenuPanel } from "./ProductsMenuPanel";
import { SITE_FOOTER, SITE_NAV } from "./site-config";
import styles from "./site.module.css";

const serif = { fontFamily: "var(--font-mkt-serif), Georgia, serif", fontStyle: "italic" } as const;

/** Shared marketing nav (200:521) and footer (200:530; tablet 768 per 253:6918 / 253:6961, md to below lg only). Server component. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${geist.variable} ${inter.variable} ${newsreader.variable} min-h-screen`}
      style={{ background: "var(--color-mkt-cream)", color: "var(--color-mkt-ink)", fontFamily: "var(--font-mkt-sans), system-ui, sans-serif" }}
    >
      <header data-node-id="203:4394" className="relative mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-10 px-5 leading-[1.38] md:px-8 xl:h-[88px] xl:gap-0 xl:px-16">
        <Link href="/" className="text-[26px] xl:w-[clamp(300px,calc(50vw_-_340px),380px)] xl:shrink-0 xl:text-[30px]" style={serif}>
          Renvani
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center justify-between gap-10 text-[14px] font-medium xl:ml-10 xl:flex" style={{ color: "var(--color-mkt-ink2)" }}>
          {SITE_NAV.links.map((l) =>
            l.href === "/product" ? (
              <HeaderDisclosure key={l.label} nodeId="177:640" className="group/products w-[90px] shrink-0" summary={<>{l.label}<ChevronDown size={12} aria-hidden="true" className="transition-transform group-open/products:rotate-180 motion-reduce:transition-none" /></>} summaryClassName="flex items-center gap-1.5 hover:underline" panelClassName="absolute inset-x-8 top-[96px] z-30 mx-auto max-h-[calc(100dvh-112px)] max-w-[1184px] overflow-y-auto rounded-[24px] shadow-[0_20px_70px_rgba(15,21,48,0.16)]">
                <ProductsMenuPanel variant="desktop" />
              </HeaderDisclosure>
            ) : l.href === "/industries" ? (
              <IndustryMenu key={l.label} label={l.label}>
                <FigmaNode node={INDUSTRY_TREES.menu!.desktop} className="w-full" />
              </IndustryMenu>
            ) : (
              <Link key={l.label} href={l.href} className={`${l.href === "/how-it-works" ? "w-[112px]" : "w-[90px]"} shrink-0 hover:underline`}>
                {l.label}
              </Link>
            )
          )}
        </nav>
        <div className="hidden shrink-0 items-center gap-4 xl:ml-4 xl:flex">
          <Link href={SITE_NAV.signIn.href} className="whitespace-nowrap text-[14px] font-medium" style={{ color: "var(--color-mkt-ink2)" }}>
            {SITE_NAV.signIn.label}
          </Link>
          <Link
            href={SITE_NAV.cta.href}
            className={`${styles.press} inline-flex min-h-[44px] items-center rounded-full px-5 py-3 text-[15px] font-medium leading-[1.5]`}
            style={{ background: "var(--color-mkt-ink)", color: "var(--color-mkt-cream)" }}
          >
            {SITE_NAV.cta.label}
          </Link>
        </div>
        {/* Mobile + tablet menu (177:737; product menu 226:7296). Hamburger per 253:6782 / 200:535. */}
        <HeaderDisclosure
          nodeId="177:737"
          className="xl:hidden"
          summaryClassName="flex size-11 items-center justify-center"
          summaryLabel={{ open: "Close menu", closed: "Open menu" }}
          summary={<img src="/marketing/home/tablet/icon-menu-fb31084f.svg" alt="" width={24} height={24} />}
          panelClassName="absolute inset-x-3 top-[80px] z-30 max-h-[calc(100dvh-92px)] overflow-y-auto rounded-[20px] shadow-[0_20px_70px_rgba(15,21,48,0.16)]"
        >
          <nav aria-label="Mobile">
            <ProductsMenuPanel variant="mobile" />
          </nav>
        </HeaderDisclosure>
      </header>
      <main>{children}</main>
      <footer data-node-id="203:4576" className="mx-auto flex max-w-[1440px] flex-col gap-6 leading-[1.38] px-6 py-6 md:grid md:grid-cols-[484px_204px] md:gap-x-4 md:gap-y-6 md:p-8 lg:flex lg:flex-row lg:flex-nowrap lg:items-start lg:justify-start lg:gap-6 lg:px-16 lg:py-16">
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
