"use client";

import {
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  type LucideIcon,
  Package,
  Repeat2,
  Search
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { INDUSTRY_PHOTOS, type IndustryPhotoSlug } from "./industry-photos";
import { INDUSTRY_PAGE_BY_SLUG } from "./industry-registry";
import { LoopPauseButton } from "./LoopPauseButton";
import { LoopVideo } from "./LoopVideo";
import { tradeLoop } from "./media-loops";
import { useLoopsPaused } from "./useLoopsPaused";
import { usePrefersReducedMotion } from "../visuals/motion";
import styles from "./industry-showcase.module.css";

type TradeCard = {
  slug: IndustryPhotoSlug;
  nodeId: string;
  badgeNodeId: string;
  outcome: string;
  qualifier: string;
  chip: string;
  Icon: LucideIcon;
};

/** Standalone, trade-specific examples — not a job sequence. */
export const TRADE_CARD_EXAMPLES = [
  {
    slug: "hvac",
    nodeId: "603:5738",
    badgeNodeId: "603:5741",
    outcome: "Keep comfort on schedule.",
    qualifier: "RETENTION · EXAMPLE",
    chip: "Spring tune-ups · 18 booked",
    Icon: CalendarDays
  },
  {
    slug: "plumbing",
    nodeId: "603:5759",
    badgeNodeId: "603:5762",
    outcome: "Keep good jobs flowing.",
    qualifier: "REVENUE · EXAMPLE",
    chip: "Water heater estimate · Option B approved",
    Icon: FileCheck2
  },
  {
    slug: "electrical",
    nodeId: "603:5778",
    badgeNodeId: "603:5781",
    outcome: "Every detail. One clear job.",
    qualifier: "OPERATIONS · EXAMPLE",
    chip: "Panel upgrade · permit checklist ready",
    Icon: ClipboardCheck
  },
  {
    slug: "appliance-repair",
    nodeId: "603:5801",
    badgeNodeId: "603:5804",
    outcome: "From diagnosis to done.",
    qualifier: "OPERATIONS · EXAMPLE",
    chip: "Part on order · customer notified",
    Icon: Package
  },
  {
    slug: "pest-control",
    nodeId: "603:5821",
    badgeNodeId: "603:5824",
    outcome: "Make the next visit easy.",
    qualifier: "RETENTION · EXAMPLE",
    chip: "Quarterly service · auto-scheduled",
    Icon: Repeat2
  },
  {
    slug: "tree-care",
    nodeId: "603:5842",
    badgeNodeId: "603:5845",
    outcome: "Keep the whole crew in sync.",
    qualifier: "GROWTH · EXAMPLE",
    chip: "Storm cleanup request · from Google",
    Icon: Search
  }
] as const satisfies readonly TradeCard[];

/** Figma 586:5737, 586:5867 and 586:6029: six photo cards with shared motion pause. */
export function IndustryShowcase() {
  const [loopsPaused] = useLoopsPaused();
  const reducedMotion = usePrefersReducedMotion();
  const playing = !loopsPaused && !reducedMotion;

  return (
    <section
      className={styles.showcase}
      aria-labelledby="home-industries-heading"
      data-node-id="586:5737"
      data-industry-gallery
      data-playing={playing}
      data-reduced-motion={reducedMotion}
    >
      <p className={styles.eyebrow}>BUILT AROUND YOUR WORK</p>
      <h2 id="home-industries-heading" className={styles.heading}>
        <span>Your trade.</span>{" "}
        <span>Your next good job.</span>
      </h2>
      <p className={styles.introduction}>See how Renvani fits the work you do.</p>
      <div className={styles.controls}>
        {!reducedMotion ? (
          <LoopPauseButton
            label="trade section"
            className={styles.outlineButton}
            hideWhenReducedMotion={false}
            playLabel="Play"
            pauseLabel="Pause"
          />
        ) : null}
        <p className={styles.motionNote}>Small moments. A smoother working day.</p>
      </div>
      <nav aria-label="Featured industries" className={styles.cardNavigation}>
        <div id="home-industry-cards" className={styles.cards}>
          {TRADE_CARD_EXAMPLES.map((card) => {
            const industry = INDUSTRY_PAGE_BY_SLUG[card.slug]!;
            const photo = INDUSTRY_PHOTOS[card.slug];
            const titleId = `home-industry-${card.slug}`;
            const outcomeId = `${titleId}-outcome`;
            const Icon = card.Icon;
            const loop = tradeLoop(card.slug);

            return (
              <Link
                key={card.slug}
                href={industry.href}
                className={styles.card}
                aria-labelledby={titleId}
                aria-describedby={outcomeId}
                data-node-id={card.nodeId}
                data-industry-card={card.slug}
              >
                {loop ? (
                  <LoopVideo
                    {...loop}
                    alt=""
                    frameClassName={`absolute inset-0 ${styles.photo}`}
                    className={styles.photo}
                    sizes="(min-width: 1440px) 411px, (min-width: 1200px) calc((100vw - 208px) / 3), (min-width: 960px) calc((100vw - 128px) / 3), (min-width: 600px) calc((100vw - 104px) / 2), calc(100vw - 40px)"
                  />
                ) : (
                  <Image
                    src={photo.src}
                    alt=""
                    fill
                    sizes="(min-width: 1440px) 411px, (min-width: 1200px) calc((100vw - 208px) / 3), (min-width: 960px) calc((100vw - 128px) / 3), (min-width: 600px) calc((100vw - 104px) / 2), calc(100vw - 40px)"
                    className={styles.photo}
                    style={{ objectPosition: photo.objectPosition }}
                    data-industry-photo={card.slug}
                  />
                )}
                <div className={styles.photoShade} aria-hidden="true" />
                <div className={styles.badge} data-node-id={card.badgeNodeId} aria-hidden="true">
                  <span className={styles.chipIcon} data-chip-icon={card.slug}>
                    <Icon size={22} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <div className={styles.badgeCopy}>
                    <p className={styles.qualifier}>{card.qualifier}</p>
                    <p className={styles.status} data-active="true">
                      {card.chip}
                    </p>
                  </div>
                </div>
                <div className={styles.tradeContent}>
                  <div className={styles.titleRow}>
                    <h3 id={titleId} className={styles.cardTitle}>
                      {industry.name}
                    </h3>
                    <span className={styles.destinationArrow} aria-hidden="true">
                      →
                    </span>
                  </div>
                  <p id={outcomeId} className={styles.outcome}>
                    {card.outcome}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className={styles.footer}>
        <p className={styles.footerNote}>Built for more of the trades you serve.</p>
        <Link href="/industries" className={styles.outlineButton}>
          All industries <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
