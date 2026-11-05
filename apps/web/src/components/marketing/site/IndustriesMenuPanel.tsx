import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import { INDUSTRY_PAGES, INDUSTRIES_OVERVIEW } from "./industry-registry";
import { IndustryIcon } from "./IndustryIcon";
import { MenuFooter } from "./MenuFooter";
import menu from "./products-menu.module.css";
import styles from "./industries-menu.module.css";

const featuredSlugs = new Set(["hvac", "plumbing", "electrical", "appliance-repair", "pest-control"]);
const featured = INDUSTRY_PAGES.filter(industry => featuredSlugs.has(industry.slug));
const additional = INDUSTRY_PAGES.filter(industry => !featuredSlugs.has(industry.slug));

/** The same card, icon, copy, spacing and secondary-link primitives as the Products dropdown. */
export function IndustryCards({ variant }: { variant: "desktop" | "mobile" }) {
  return <nav aria-label="Renvani industries" data-industry-menu-variant={variant}>
    <div className={menu.productCards}>{featured.map(industry => <Link key={industry.slug} href={industry.href} aria-label={industry.name} className={`${menu.productCard} ${industry.slug === "electrical" ? menu.commandCard : ""}`}>
      <span className={menu.productIcon}><IndustryIcon slug={industry.slug} size={20} /></span>
      <span className={menu.productCopy}><span className={menu.productName}>{industry.name}</span><span className={menu.productDescription}>{industry.tagline}</span></span>
      <ArrowUpRight size={16} strokeWidth={1.7} aria-hidden="true" className={menu.productArrow} />
    </Link>)}</div>
    <section className={menu.toolsSection} aria-label="More industries"><p className={menu.sectionLabel}>More of the trades you serve</p><div className={menu.toolsGrid}>{additional.map(industry => <Link key={industry.slug} href={industry.href} aria-label={industry.name} className={menu.toolLink}>{industry.name}</Link>)}</div></section>
  </nav>;
}

export function IndustriesMenuPanel() {
  return <div className={menu.panel} data-menu-design="shared-product-cards"><div className={menu.content}><div className={menu.heading}><p className={menu.headingLabel}>Built around your work.</p><Link href={INDUSTRIES_OVERVIEW.href} className={menu.allProducts}>All industries<ArrowRight size={15} aria-hidden="true" /></Link></div><IndustryCards variant="desktop" /></div><MenuFooter /></div>;
}

export function MobileIndustriesMenu() {
  return <details data-industry-menu="" className={styles.disclosure}><summary className={styles.summary}>Industries<ChevronDown size={16} aria-hidden="true" /></summary><div className={styles.mobileContent}><IndustryCards variant="mobile" /><Link href={INDUSTRIES_OVERVIEW.href} className={menu.allProducts}>All industries<ArrowRight size={15} aria-hidden="true" /></Link></div></details>;
}
