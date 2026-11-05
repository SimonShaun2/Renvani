import Link from "next/link";
import { ArrowUpRight, Zap } from "lucide-react";

import { ADDITIONAL_INDUSTRIES, FEATURED_INDUSTRIES, INDUSTRY_PAGES, type IndustryEntry, type FeaturedIndustrySlug } from "./industry-registry";
import styles from "./industry-pages.module.css";

/** Existing illustrative source assets, reused by the exact Figma featured-card components. */
const FEATURED_IMAGES: Partial<Record<FeaturedIndustrySlug, string>> = {
  hvac: "/marketing/industries/illustrative-hvac-field-work-f1266660.jpg",
  plumbing: "/marketing/industries/illustrative-plumbing-field-work-5d7f94f5.jpg"
};

export function FeaturedIndustryCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.featuredGrid} ${compact ? styles.compactFeatured : ""}`}>
      {FEATURED_INDUSTRIES.map((industry) => {
        const image = FEATURED_IMAGES[industry.slug as FeaturedIndustrySlug];
        return (
          <Link key={industry.slug} href={industry.href} aria-label={industry.name} className={`${styles.featuredCard} ${industry.slug === "electrical" ? styles.electrical : ""}`}>
            {image ? (
              <img src={image} alt="" width={520} height={320} className={styles.featuredMedia} />
            ) : (
              <span className={`${styles.featuredMedia} ${styles.electricalVisual}`} aria-hidden="true"><Zap size={56} strokeWidth={1.5} /></span>
            )}
            <span className={styles.featuredCopy}>
              <span className={styles.featuredName}>{industry.name}</span>
              <span className={styles.featuredDescription}>{industry.tagline}</span>
              {industry.slug === "electrical" ? <span className={styles.featuredQualifier}>Workflow example</span> : null}
            </span>
            {compact ? <ArrowUpRight size={16} aria-hidden="true" className={styles.featuredArrow} /> : null}
          </Link>
        );
      })}
    </div>
  );
}

export function IndustryLinkGrid({ industries = INDUSTRY_PAGES, compact = false }: { industries?: readonly IndustryEntry[]; compact?: boolean }) {
  return (
    <div className={`${styles.linkGrid} ${compact ? styles.compactLinks : ""}`}>
      {industries.map((industry) => (
        <Link key={industry.slug} href={industry.href} aria-label={industry.name} className={styles.industryLink}>
          <span>{industry.name}</span><ArrowUpRight size={16} strokeWidth={1.6} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

/** Directory frames 580:5544 / 580:5623 / 580:5700. The shell supplies the existing header and footer. */
export function IndustryDirectory() {
  return (
    <div className={styles.page} data-node-id="580:5544">
      <section className={styles.directoryIntro}>
        <p className={styles.eyebrow}>Industries</p>
        <h1 className={styles.directoryTitle}>Your trade.<br />Your next good job.</h1>
        <p className={styles.lead}>Different trades. One connected path from the first request to the next visit.</p>
      </section>
      <nav aria-label="Industry directory" className={styles.directoryContent}>
        <FeaturedIndustryCards />
        <h2 className={styles.directoryHeading}>Find your line of work.</h2>
        <IndustryLinkGrid industries={ADDITIONAL_INDUSTRIES} />
        <p className={styles.note}>Illustrative service workflows. Explore the example for your trade.</p>
      </nav>
      <section className={styles.closing} aria-label="Explore Renvani">
        <h2>See the work come together.</h2>
        <Link href="/demo" className={styles.primaryButton}>See Renvani in action</Link>
      </section>
    </div>
  );
}

/** Compact homepage directory: 580:6036 (desktop), 586:5867 (tablet), 586:6029 (mobile). */
export function HomeIndustriesSection() {
  return (
    <section className={styles.homeSection} aria-labelledby="home-industries-heading" data-node-id="580:6036">
      <p className={styles.eyebrow}>Built around your work</p>
      <h2 id="home-industries-heading" className={styles.homeHeading}><span>Your trade.</span>{" "}<span>Your next good job.</span></h2>
      <p className={styles.lead}>Explore a connected service workflow for the work you do.</p>
      <nav aria-label="Find your industry"><IndustryLinkGrid /></nav>
    </section>
  );
}
