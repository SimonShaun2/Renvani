import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, Droplets, Snowflake, Zap } from "lucide-react";
import { ADDITIONAL_INDUSTRIES, FEATURED_INDUSTRIES, INDUSTRIES_OVERVIEW } from "./industry-registry";
import { MenuFooter } from "./MenuFooter";
import menu from "./products-menu.module.css";
import styles from "./industries-menu.module.css";

const ICONS = { hvac: Snowflake, plumbing: Droplets, electrical: Zap };

/** Preserve the approved three featured trades and eleven additional destinations.
 * Styling comes directly from Products; Products inventory and components are not edited.
 */
export function IndustryCards({ variant }: { variant: "desktop" | "mobile" }) {
  return <nav aria-label="Renvani industries" data-industry-menu-variant={variant}>
    <div className={menu.productCards} style={variant === "desktop" ? { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } : undefined}>
      {FEATURED_INDUSTRIES.map((industry) => {
        const Icon = ICONS[industry.slug as keyof typeof ICONS];
        return <Link key={industry.slug} href={industry.href} aria-label={industry.name} className={`${menu.productCard} ${industry.slug === "electrical" ? menu.commandCard : ""}`}>
          <span className={menu.productIcon}><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className={menu.productCopy}><span className={menu.productName}>{industry.name}</span><span className={menu.productDescription}>{industry.tagline}</span></span>
          <ArrowUpRight size={16} strokeWidth={1.7} aria-hidden="true" className={menu.productArrow} />
        </Link>;
      })}
    </div>
    <section className={menu.toolsSection} aria-label="More industries"><p className={menu.sectionLabel}>More industries</p><div className={menu.toolsGrid}>
      {ADDITIONAL_INDUSTRIES.map((industry) => <Link key={industry.slug} href={industry.href} aria-label={industry.name} className={menu.toolLink}>{industry.name}</Link>)}
    </div></section>
  </nav>;
}

export function IndustriesMenuPanel() {
  return <div className={menu.panel} data-industry-style="products-menu">
    <div className={menu.content}><div className={menu.heading}><p className={menu.headingLabel}>Built around your work.</p><Link href={INDUSTRIES_OVERVIEW.href} className={menu.allProducts}>All industries<ArrowRight size={15} aria-hidden="true" /></Link></div><IndustryCards variant="desktop" /></div>
    <MenuFooter />
  </div>;
}

export function MobileIndustriesMenu() {
  return <details data-industry-menu="" className={styles.disclosure}>
    <summary className={styles.summary}>Industries<ChevronDown size={16} aria-hidden="true" /></summary>
    <div className={styles.mobileContent}><IndustryCards variant="mobile" /><Link href={INDUSTRIES_OVERVIEW.href} className={menu.allProducts}>All industries<ArrowRight size={15} aria-hidden="true" /></Link></div>
  </details>;
}
