import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

import { ADDITIONAL_INDUSTRIES, INDUSTRIES_OVERVIEW, INDUSTRY_MENU_FRAME } from "./industry-registry";
import { FeaturedIndustryCards, IndustryLinkGrid } from "./IndustryDirectory";
import { MenuFooter } from "./MenuFooter";
import menu from "./products-menu.module.css";
import styles from "./industries-menu.module.css";

/** One accessible inventory: the three featured trades and eleven compact destinations. */
export function IndustryCards({ variant }: { variant: "desktop" | "mobile" }) {
  return (
    <nav aria-label="Renvani industries" className={`${styles.inventory} ${variant === "mobile" ? styles.mobileInventory : ""}`}>
      <FeaturedIndustryCards compact={variant === "mobile"} />
      <p className={styles.moreLabel}>More industries</p>
      <IndustryLinkGrid industries={ADDITIONAL_INDUSTRIES} compact />
    </nav>
  );
}

/** Expanded menu from 580:5967, retaining the shared footer's working Close, Growth Check and demo actions. */
export function IndustriesMenuPanel() {
  return (
    <div className={`${menu.panel} ${styles.panel}`} data-node-id={INDUSTRY_MENU_FRAME}>
      <div className={styles.content}>
        <div className={styles.heading}>
          <p className={styles.headingLabel}>Built around your work.</p>
          <Link href={INDUSTRIES_OVERVIEW.href} className={styles.allIndustries}>All industries<ArrowRight size={15} aria-hidden="true" /></Link>
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
