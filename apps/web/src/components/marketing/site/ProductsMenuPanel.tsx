import Link from "next/link";

import { MaybeLink } from "./MaybeLink";
import { PRODUCTS_MENU, SITE_NAV } from "./site-config";

const ink = { color: "var(--color-mkt-ink)" } as const;
const Arrow = ({ size }: { size: 16 | 20 }) => <img src="/marketing/menu/arrow.svg" alt="" width={size} height={size} className="shrink-0" style={{ width: size, height: size }} />;
const row = "flex w-full items-center gap-2 rounded-[12px] bg-white p-3 text-left text-[14px] font-medium leading-[1.38]";

/** Product menu content: desktop 226:7154 (in 177:640) and mobile 226:7296 (in 177:737). Server component. */
export function ProductsMenuPanel({ variant }: { variant: "desktop" | "mobile" }) {
  const m = variant === "mobile";
  return (
    <div data-node-id={m ? "226:7296" : "226:7154"} className={m ? "flex flex-col gap-7 p-6" : "mx-auto flex max-w-[1440px] flex-col gap-9 p-16"} style={{ background: "var(--color-mkt-cream)" }}>
      <div className={m ? "flex flex-col items-center gap-5" : "flex items-center gap-5"}>
        <p className={`${m ? "w-full text-[28px]" : "flex-1 text-[32px]"} font-semibold leading-[1.38]`} style={ink}>
          {m ? MOBILE_HEADLINE : PRODUCTS_MENU.headline}
        </p>
        <Link href={PRODUCTS_MENU.all.href} className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full px-5 py-3 text-[15px] font-medium leading-[1.5]" style={{ background: "var(--color-mkt-ink)", color: "var(--color-mkt-cream)" }}>
          {PRODUCTS_MENU.all.label}
        </Link>
      </div>
      {m ? (
        <nav aria-label="Explore the website" className="flex flex-col gap-2">
          {[...MOBILE_EXPLORE, SITE_NAV.signIn].map((l) => (
            <Link key={l.label} href={l.href} className={row} style={ink}>
              <span className="flex-1">{l.label}</span>
              <Arrow size={16} />
            </Link>
          ))}
        </nav>
      ) : null}
      <div className={m ? "flex flex-col gap-7" : "flex items-start gap-6"}>
        {PRODUCTS_MENU.groups.map((g) => (
          <div key={g.title} className={`flex flex-col gap-[10px] ${m ? "w-full" : "min-w-0 flex-1"}`}>
            <Link href={g.href} className="flex w-full items-start gap-2 text-left text-[20px] font-semibold leading-[1.38]" style={ink}>
              <span className="flex-1">{g.title}</span>
              <Arrow size={20} />
            </Link>
            {g.items.map((i) => (
              <MaybeLink key={i.label} href={i.href} className={row} style={ink}>
                <span className="flex-1">{i.label}</span>
                <Arrow size={16} />
              </MaybeLink>
            ))}
          </div>
        ))}
      </div>
      <div className={m ? "flex flex-col items-center gap-4" : "flex items-center gap-4"}>
        <Link href={PRODUCTS_MENU.cta.href} className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 py-3 text-[15px] font-medium leading-[1.5]" style={{ background: "var(--color-mkt-amber)", color: "var(--color-mkt-ink)" }}>
          {PRODUCTS_MENU.cta.label}
        </Link>
        <button type="button" data-menu-close="" className={`${m ? "w-full" : "w-[160px]"} cursor-pointer text-left text-[13px] font-medium leading-[1.38]`} style={{ color: "var(--color-mkt-ink2)" }}>
          Close menu
        </button>
      </div>
    </div>
  );
}

/** Mobile menu (177:737) heading and "Explore the website" rows. */
export const MOBILE_HEADLINE = "Find your next step.";
export const MOBILE_EXPLORE = [
  { label: "Industries", href: "/industries" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Growth Check", href: "/growth-check" }
];
