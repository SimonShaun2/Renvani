import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ADDITIONAL_INDUSTRIES, FEATURED_INDUSTRIES, INDUSTRY_PAGES, type IndustryEntry, type FeaturedIndustrySlug } from "./industry-registry";
import { INDUSTRY_PHOTOS } from "./industry-photos";
import styles from "./industry-pages.module.css";

export function FeaturedIndustryCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.featuredGrid} ${compact ? styles.compactFeatured : ""}`}>
      {FEATURED_INDUSTRIES.map((industry) => {
        const photo = INDUSTRY_PHOTOS[industry.slug as FeaturedIndustrySlug];
        return (
          <Link key={industry.slug} href={industry.href} aria-label={industry.name} className={styles.featuredCard}>
            <img src={photo.src} alt="" width={520} height={320} className={styles.featuredMedia} style={{ objectPosition: photo.objectPosition }} />
            <span className={styles.featuredCopy}>
              <span className={styles.featuredName}>{industry.name}</span>
              <span className={styles.featuredDescription}>{industry.tagline}</span>
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
