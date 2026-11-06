"use client";

import Image from "next/image";
import Link from "next/link";

import { INDUSTRY_PHOTOS, type IndustryPhotoSlug } from "./industry-photos";
import { INDUSTRY_PAGE_BY_SLUG } from "./industry-registry";
import { LoopVideo } from "./LoopVideo";
import { tradeLoop } from "./media-loops";
import { usePrefersReducedMotion } from "../visuals/motion";
import styles from "./industry-showcase.module.css";

const FEATURED_INDUSTRIES = [
  {
    slug: "hvac", nodeId: "603:5738",
    outcome: "Keep comfort on schedule."
  },
  {
    slug: "plumbing", nodeId: "603:5759",
    outcome: "Keep good jobs flowing."
  },
  {
    slug: "electrical", nodeId: "603:5778",
    outcome: "Every detail. One clear job."
  },
  {
    slug: "appliance-repair", nodeId: "603:5801",
    outcome: "From diagnosis to done."
  },
  {
    slug: "pest-control", nodeId: "603:5821",
    outcome: "Make the next visit easy."
  },
  {
    slug: "tree-care", nodeId: "603:5842",
    outcome: "Keep the whole crew in sync."
  }
] as const satisfies readonly {
  slug: IndustryPhotoSlug;
  nodeId: string;
  outcome: string;
}[];

/** Figma 586:5737, 586:5867 and 586:6029: six photo cards with muted trade loops that autoplay at load. */
export function IndustryShowcase() {
  const reducedMotion = usePrefersReducedMotion();
  const playing = !reducedMotion;

  return (
    <section className={styles.showcase} aria-labelledby="home-industries-heading" data-node-id="586:5737" data-industry-gallery data-playing={playing} data-reduced-motion={reducedMotion}>
      <p className={styles.eyebrow}>BUILT AROUND YOUR WORK</p>
      <h2 id="home-industries-heading" className={styles.heading}><span>Your trade.</span>{" "}<span>Your next good job.</span></h2>
      <p className={styles.introduction}>See how Renvani fits the work you do.</p>
      <div className={styles.controls}>
        <p className={styles.motionNote}>Small moments. A smoother working day.</p>
      </div>
      <nav aria-label="Featured industries" className={styles.cardNavigation}>
        <div id="home-industry-cards" className={styles.cards}>
          {FEATURED_INDUSTRIES.map((card) => {
            const industry = INDUSTRY_PAGE_BY_SLUG[card.slug]!;
            const photo = INDUSTRY_PHOTOS[card.slug];
            const titleId = `home-industry-${card.slug}`;
            const outcomeId = `${titleId}-outcome`;
            const loop = tradeLoop(card.slug);
            const sizes = "(min-width: 1440px) 411px, (min-width: 1200px) calc((100vw - 208px) / 3), (min-width: 960px) calc((100vw - 128px) / 3), (min-width: 600px) calc((100vw - 104px) / 2), calc(100vw - 40px)";

            return (
              <Link key={card.slug} href={industry.href} className={styles.card} aria-labelledby={titleId} aria-describedby={outcomeId} data-node-id={card.nodeId} data-industry-card={card.slug}>
                {loop ? (
                  <LoopVideo {...loop} attachOnLoad alt="" frameClassName={`absolute inset-0 ${styles.photo}`} className={styles.photo} sizes={sizes} />
                ) : (
                  <Image src={photo.src} alt="" fill sizes={sizes} className={styles.photo} style={{ objectPosition: photo.objectPosition }} data-industry-photo={card.slug} />
                )}
                <div className={styles.photoShade} aria-hidden="true" />
                <div className={styles.tradeContent}>
                  <div className={styles.titleRow}>
                    <h3 id={titleId} className={styles.cardTitle}>{industry.name}</h3>
                    <span className={styles.destinationArrow} aria-hidden="true">→</span>
                  </div>
                  <p id={outcomeId} className={styles.outcome}>{card.outcome}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className={styles.footer}>
        <p className={styles.footerNote}>Built for more of the trades you serve.</p>
        <Link href="/industries" className={styles.outlineButton}>All industries <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
