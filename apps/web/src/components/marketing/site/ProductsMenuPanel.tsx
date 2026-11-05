import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Layers, LayoutDashboard, Megaphone, Repeat2, TrendingUp, type LucideIcon } from "lucide-react";

import { MaybeLink } from "./MaybeLink";
import { MobileIndustriesMenu } from "./IndustriesMenuPanel";
import { MenuFooter } from "./MenuFooter";
import { PRODUCTS_MENU, SITE_NAV } from "./site-config";
import styles from "./products-menu.module.css";

const PRODUCT_DETAILS: Record<string, { description: string; Icon: LucideIcon }> = {
  "/product/growth": { description: "Book more direct jobs.", Icon: Megaphone },
  "/product/revenue": { description: "Turn inquiries into approved work.", Icon: TrendingUp },
  "/product/operations": { description: "Keep every job moving.", Icon: CalendarDays },
  "/product/retention": { description: "Keep customers coming back.", Icon: Repeat2 },
  "/product/command-center": { description: "See what needs your attention.", Icon: LayoutDashboard }
};

function ProductCards() {
  return (
    <nav aria-label="Renvani products" className={styles.productCards}>
      {PRODUCTS_MENU.groups.map((product) => {
        const { description, Icon } = PRODUCT_DETAILS[product.href] ?? { description: "Explore this product.", Icon: Layers };
        return (
          <Link
            key={product.href}
            href={product.href}
            aria-label={product.title}
            className={`${styles.productCard} ${product.href === "/product/command-center" ? styles.commandCard : ""}`}
          >
            <span className={styles.productIcon}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
            <span className={styles.productCopy}>
              <span className={styles.productName}>{product.title}</span>
              <span className={styles.productDescription}>{description}</span>
            </span>
            <ArrowUpRight size={16} strokeWidth={1.7} aria-hidden="true" className={styles.productArrow} />
          </Link>
        );
      })}
    </nav>
  );
}

function ProductTools() {
  return (
    <nav aria-label="Product tools" className={styles.toolsGrid}>
      {PRODUCTS_MENU.groups.flatMap((group) => group.items).map((tool) => (
        <MaybeLink key={tool.label} href={tool.href} className={styles.toolLink ?? ""}>{tool.label}</MaybeLink>
      ))}
    </nav>
  );
}

/** Founder-requested alternative to the original Figma menu. Native navigation, with no hover-only content. */
export function ProductsMenuPanel({ variant }: { variant: "desktop" | "mobile" }) {
  const mobile = variant === "mobile";
  return (
    <div className={`${styles.panel} ${mobile ? styles.mobile : ""}`}>
      <div className={styles.content}>
        <div className={styles.heading}>
          <p className={styles.headingLabel}>{mobile ? MOBILE_HEADLINE : "The Renvani platform"}</p>
          <Link href={PRODUCTS_MENU.all.href} className={styles.allProducts}>
            {PRODUCTS_MENU.all.label}<ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <ProductCards />
        {mobile ? (
          <details data-product-tools="" className={styles.toolsDisclosure}>
            <summary className={styles.toolsSummary}>
              Explore all tools<ChevronDown size={16} aria-hidden="true" />
            </summary>
            <ProductTools />
          </details>
        ) : (
          <section aria-label="Everyday tools" className={styles.toolsSection}>
            <p className={styles.sectionLabel}>Everything behind a great service business</p>
            <ProductTools />
          </section>
        )}
        {mobile ? <MobileIndustriesMenu /> : null}
        {mobile ? (
          <nav aria-label="Explore the website" className={styles.explore}>
            {[...MOBILE_EXPLORE, SITE_NAV.signIn].map((link) => (
              <Link key={link.href} href={link.href} className={styles.exploreLink}>
                {link.label}<ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
      <MenuFooter mobile={mobile} />
    </div>
  );
}

export const MOBILE_HEADLINE = "Explore Renvani.";
export const MOBILE_EXPLORE = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Growth Check", href: "/growth-check" }
];
