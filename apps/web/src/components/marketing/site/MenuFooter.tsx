import Link from "next/link";
import { ArrowRight, ArrowUpRight, X } from "lucide-react";

import { SITE_NAV } from "./site-config";
import styles from "./products-menu.module.css";

/** Shared actions for the Products, Industries and mobile navigation panels. */
export function MenuFooter({ mobile = false }: { mobile?: boolean }) {
  return (
    <div className={styles.footer}>
      {!mobile ? (
        <Link href="/growth-check" className={styles.growthCheck}>
          <span className={styles.growthDot} aria-hidden="true" />
          Find your next opportunity<span className={styles.growthCheckLabel}>Growth Check<ArrowUpRight size={14} aria-hidden="true" /></span>
        </Link>
      ) : null}
      <div className={styles.footerActions}>
        <button type="button" data-menu-close="" className={styles.closeButton}>
          <X size={14} aria-hidden="true" />Close menu
        </button>
        <Link href={SITE_NAV.cta.href} className={styles.demoButton}>
          {SITE_NAV.cta.label}<ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
