import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { FEATURED_INDUSTRIES, INDUSTRY_PAGES, type IndustryEntry, type FeaturedIndustrySlug } from "./industry-registry";
import { INDUSTRY_PHOTOS } from "./industry-photos";
import styles from "./industry-pages.module.css";
import detail from "./subpage.module.css";
import { IndustryIcon } from "./IndustryIcon";
import { FinalCta, SectionHeading, SubpageHero } from "./SubpageShared";

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

/** Unified responsive directory. Existing card/link primitives remain available to other consumers. */
export function IndustryDirectory() {
  return <div className={detail.page} data-marketing-template="industry-directory">
    <SubpageHero eyebrow="BUILT AROUND YOUR WORK" title="Your trade. Your next good job." description="Different trades. One connected path from the first request to the next visit." secondary={{label:"Find your industry",href:"#industry-directory"}} />
    <section className={detail.section} id="industry-directory"><SectionHeading eyebrow="THE WAY YOU WORK" title="Find your line of work." description="Explore a service journey for your business. The shared workflow stays connected; the details stay yours." />
      <nav aria-label="Industry directory" className={detail.industryGrid}>{INDUSTRY_PAGES.map(industry=><Link key={industry.slug} href={industry.href} aria-label={industry.name} className={detail.industryCard}><IndustryIcon slug={industry.slug} size={28}/><h2>{industry.name}</h2><p>{industry.tagline}</p><ArrowUpRight size={20} aria-hidden="true"/></Link>)}</nav>
      <p className={detail.note}>Illustrative service workflows. Confirm specialized trade requirements and availability during your demo.</p>
    </section><FinalCta title="See the work come together." />
  </div>;
}
