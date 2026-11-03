import Link from "next/link";
import { DailyBriefCard } from "./DailyBriefCard";
import { DirectDemandCard } from "./DirectDemandCard";
import { OwnerBusinessRail, OwnerKeyNumbers } from "./OwnerHomePanels";
import { LocalDate, LocalGreeting } from "./LocalClock";
import { HeaderSummary, NeedsYou } from "./NeedsYou";
import styles from "./owner-home.module.css";
import "./command-center-motion.css";

export interface CommandCenterViewProps { firstName: string | null }

/** Figma 399:4218. The prototype's people, dates and metrics are never production fixtures. */
export function CommandCenterView({ firstName }: CommandCenterViewProps) {
  return (
    <div className={styles.home} data-figma="399:4218" data-testid="owner-home">
      <header className={styles.header} data-figma="399:4221">
        <div className={styles.heading}>
          <h1><span><LocalGreeting /></span>{firstName ? <span className={styles.name}>{firstName}.</span> : null}</h1>
          <p className={styles.meta}><LocalDate /> · <HeaderSummary /></p>
        </div>
        <div className={styles.actions}>
          <Link href="/customers" className={styles.secondary} aria-label="Search customer records">Search</Link>
          {/* Existing approvals/inquiries inbox is functional; do not claim a nonexistent create endpoint. */}
          <Link href="/command-center/approvals" className={styles.primary}>Review actions</Link>
        </div>
      </header>
      <DailyBriefCard />
      <OwnerKeyNumbers />
      <div className={styles.body} data-figma="399:4252">
        <NeedsYou />
        <aside className={styles.rail} data-figma="399:4325" aria-label="Business activity"><OwnerBusinessRail /></aside>
      </div>
      <details className={styles.supplement}>
        <summary>Direct-demand revenue details</summary>
        <DirectDemandCard />
      </details>
    </div>
  );
}
