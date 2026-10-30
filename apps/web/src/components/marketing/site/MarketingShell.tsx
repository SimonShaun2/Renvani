import Link from "next/link";
import type { ReactNode } from "react";

import { geist, newsreader } from "./fonts";
import { ProductsMenu } from "./ProductsMenu";
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
      <header data-node-id="203:4394" className="relative mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-10 px-6 md:h-[88px] md:px-16">
        <Link href="/" className="text-[26px] md:text-[30px]" style={serif}>
          Renvani
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-10 text-[14px] font-medium md:flex" style={{ color: "var(--color-mkt-ink2)" }}>
          {SITE_NAV.links.map((l) =>
            l.href === "/product" ? (
              <ProductsMenu key={l.label} label={l.label} />
            ) : (
              <Link key={l.label} href={l.href} className="hover:underline">
                {l.label}
              </Link>
            )
          )}
        </nav>
        <div className="hidden items-center gap-4 md:flex">
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
        <details data-node-id="177:737" className="relative md:hidden">
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center rounded-full border px-4 text-[14px] font-medium" style={{ borderColor: "var(--color-mkt-ink)" }}>
            Menu
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
      <footer data-node-id="203:4576" className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-12 md:flex-row md:items-start md:px-16 md:py-16">
        <p className="text-[28px] md:w-[350px]" style={serif}>
          Renvani
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-4 text-[12px] md:w-[510px]" style={{ color: "var(--color-mkt-ink2)" }}>
          {SITE_FOOTER.links.map((l) => (
            <Link key={l.label} href={l.href} className="min-w-[112px]">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-[11px]" style={{ color: "var(--color-mkt-ink2)" }}>
          {SITE_FOOTER.copyright}
        </p>
      </footer>
    </div>
  );
}
