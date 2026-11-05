import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, Zap } from "lucide-react";

import { INDUSTRIES_OVERVIEW, INDUSTRY_PAGES, type IndustryEntry } from "./industry-registry";
import { MenuFooter } from "./MenuFooter";
import menu from "./products-menu.module.css";
import styles from "./industries-menu.module.css";

/** Current Figma industry copy and photographs, adapted to the founder-requested floating menu. */
const INDUSTRY_DETAILS: Record<IndustryEntry["slug"], { description: string; image?: string }> = {
  hvac: { description: "From no heat to next season.", image: "/marketing/industries/illustrative-hvac-field-work-f1266660.jpg" },
  plumbing: { description: "Keep good jobs flowing.", image: "/marketing/industries/illustrative-plumbing-field-work-5d7f94f5.jpg" },
  electrical: { description: "Every detail. One clear job." }
};

export function IndustryCards({ variant }: { variant: "desktop" | "mobile" }) {
  return (
    <nav aria-label="Renvani industries" className={`${styles.cards} ${variant === "mobile" ? styles.mobileCards : ""}`}>
      {INDUSTRY_PAGES.map((industry) => {
        const { description, image } = INDUSTRY_DETAILS[industry.slug];
        return (
          <Link key={industry.slug} href={industry.href} aria-label={industry.name} className={`${styles.card} ${industry.slug === "electrical" ? styles.electrical : ""}`}>
            {image ? (
              <img src={image} alt="" width={520} height={320} className={styles.photo} />
            ) : (
              <span className={styles.workflowVisual} aria-hidden="true"><span className={styles.electricalIcon}><Zap size={32} strokeWidth={1.5} /></span></span>
            )}
            <span className={styles.copy}>
              <span className={styles.name}>{industry.name}</span>
              <span className={styles.description}>{description}</span>
              {industry.slug === "electrical" ? <span className={styles.qualifier}>Workflow example</span> : null}
            </span>
            <ArrowUpRight size={18} strokeWidth={1.7} aria-hidden="true" className={styles.arrow} />
          </Link>
        );
      })}
    </nav>
  );
}

export function IndustriesMenuPanel() {
  return (
    <div className={menu.panel}>
      <div className={menu.content}>
        <div className={menu.heading}>
          <p className={menu.headingLabel}>Built around your work.</p>
          <Link href={INDUSTRIES_OVERVIEW.href} className={menu.allProducts}>All industries<ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <IndustryCards variant="desktop" />
      </div>
      <MenuFooter />
    </div>
  );
}

/** Native nested disclosure intentionally has no name: expanding it must keep the outer menu open. */
export function MobileIndustriesMenu() {
  return (
    <details data-industry-menu="" className={styles.disclosure}>
      <summary className={styles.summary}>Industries<ChevronDown size={16} aria-hidden="true" /></summary>
      <div className={styles.mobileContent}>
        <IndustryCards variant="mobile" />
        <Link href={INDUSTRIES_OVERVIEW.href} className={styles.allIndustries}>All industries<ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </details>
  );
}
