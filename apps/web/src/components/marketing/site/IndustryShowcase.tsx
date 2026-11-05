"use client";

import Image from "next/image";
import Link from "next/link";

import { INDUSTRY_PHOTOS, type IndustryPhotoSlug } from "./industry-photos";
import { INDUSTRY_PAGE_BY_SLUG } from "./industry-registry";
import { useWorkflowPlayback } from "./useWorkflowPlayback";
import styles from "./industry-showcase.module.css";

type MiniWorkflow = "schedule" | "dispatch" | "tasks" | "progress" | "return-visit" | "crew";

const FEATURED_INDUSTRIES = [
  {
    slug: "hvac", workflow: "schedule", nodeId: "603:5738", badgeNodeId: "603:5741",
    outcome: "Keep comfort on schedule.", qualifier: "SCHEDULE · EXAMPLE",
    phases: ["Request received", "Visit scheduled", "Visit confirmed"]
  },
  {
    slug: "plumbing", workflow: "dispatch", nodeId: "603:5759", badgeNodeId: "603:5762",
    outcome: "Keep good jobs flowing.", qualifier: "DISPATCH · EXAMPLE",
    phases: ["Work approved", "Technician assigned", "Dispatch ready"]
  },
  {
    slug: "electrical", workflow: "tasks", nodeId: "603:5778", badgeNodeId: "603:5781",
    outcome: "Every detail. One clear job.", qualifier: "JOB TASKS · EXAMPLE",
    phases: ["Scope confirmed", "Tasks in progress", "Job checks recorded"]
  },
  {
    slug: "appliance-repair", workflow: "progress", nodeId: "603:5801", badgeNodeId: "603:5804",
    outcome: "From diagnosis to done.", qualifier: "JOB PROGRESS · EXAMPLE",
    phases: ["Issue captured", "Repair in progress", "Job photos saved"]
  },
  {
    slug: "pest-control", workflow: "return-visit", nodeId: "603:5821", badgeNodeId: "603:5824",
    outcome: "Make the next visit easy.", qualifier: "RETURN VISIT · EXAMPLE",
    phases: ["Visit complete", "Follow-up prepared", "Return visit planned"]
  },
  {
    slug: "tree-care", workflow: "crew", nodeId: "603:5842", badgeNodeId: "603:5845",
    outcome: "Keep the whole crew in sync.", qualifier: "CREW PLAN · EXAMPLE",
    phases: ["Work scoped", "Crew assigned", "Crew plan ready"]
  }
] as const satisfies readonly {
  slug: IndustryPhotoSlug;
  workflow: MiniWorkflow;
  nodeId: string;
  badgeNodeId: string;
  outcome: string;
  qualifier: string;
  phases: readonly [string, string, string];
}[];

const MINI_ASSET_ROOT = "/marketing/industry-gallery";

/** Decorative, illustrative operation states. These never perform customer or product actions. */
function MiniOperation({ workflow, phase }: { workflow: MiniWorkflow; phase: number }) {
  return (
    <div className={styles.miniUI} data-mini-workflow={workflow} data-phase={phase}>
      {workflow === "schedule" && (
        <>
          <span className={styles.calendarLabel}>MON</span>
          <div className={styles.calendarSlots}>
            {[0, 1, 2, 3, 4, 5].map((slot) => (
              <span key={slot} className={styles.calendarSlot} data-selected={slot === 4 && phase >= 1}>
                {slot === 4 && <span className={styles.checkMark} data-ready={phase === 2}>✓</span>}
              </span>
            ))}
          </div>
        </>
      )}
      {workflow === "dispatch" && (
        <>
          {[0, 1, 2].map((stop) => (
            <span key={stop} className={styles.dispatchStop} data-ready={phase >= stop} style={{ left: 8 + stop * 16, top: 14 + stop * 10 }}>
              <Image src={`${MINI_ASSET_ROOT}/dispatch-stop-${stop === 2 ? "amber" : "navy"}.svg`} alt="" width={8} height={8} />
            </span>
          ))}
          {[0, 1].map((segment) => (
            <span key={segment} className={styles.routeSegment} data-ready={phase > segment} style={{ left: 14 + segment * 16, top: 19 + segment * 10 }} />
          ))}
          <span className={styles.dispatchLabel} data-ready={phase === 2}>READY</span>
        </>
      )}
      {workflow === "tasks" && (
        <div className={styles.tasks}>
          {[0, 1, 2].map((task) => (
            <div key={task} className={styles.task}>
              <span className={styles.taskBox} data-ready={phase >= task}>
                <span className={styles.checkMark} data-ready={phase >= task}>✓</span>
              </span>
              <span className={styles.taskLine} style={{ width: 26 - task * 4 }} />
            </div>
          ))}
        </div>
      )}
      {workflow === "progress" && (
        <>
          <span className={styles.jobLabel}>JOB</span>
          <div className={styles.jobProgress}>
            {[0, 1, 2].map((item) => (
              <span key={item} className={styles.progressTrack}>
                <span className={styles.progressFill} data-ready={phase >= item} style={{ width: 40 - item * 4 }} />
              </span>
            ))}
          </div>
        </>
      )}
      {workflow === "return-visit" && (
        <>
          <span className={styles.returnLabel}>NEXT VISIT</span>
          <div className={styles.returnSlots}>
            {[0, 1, 2].map((slot) => <span key={slot} className={styles.returnSlot} data-selected={phase === slot}>{slot + 1}</span>)}
          </div>
          <span className={styles.returnProgress} style={{ transform: `scaleX(${(phase + 1) / 3})` }} />
        </>
      )}
      {workflow === "crew" && (
        <>
          {[0, 1, 2].map((person) => (
            <span key={person} className={styles.crewAssignment} data-ready={phase >= person} style={{ left: 5 + person * 15 }}>
              <Image src={`${MINI_ASSET_ROOT}/crew-assignment-${person === 2 ? "amber" : "white"}.svg`} alt="" width={15} height={15} />
              <span className={styles.crewNumber}>{person + 1}</span>
            </span>
          ))}
          <span className={styles.crewProgress} style={{ transform: `scaleX(${(phase + 1) / 3})` }} />
          <span className={styles.crewLabel} data-ready={phase >= 1}>ASSIGNED</span>
        </>
      )}
    </div>
  );
}

/** Figma 586:5737, 586:5867 and 586:6029: six photo cards with optional shared motion. */
export function IndustryShowcase() {
  // Any visible portion of the tall mobile gallery may animate; the product-tour default stays unchanged.
  const playback = useWorkflowPlayback("industry-gallery", 3, 0);

  return (
    <section className={styles.showcase} aria-labelledby="home-industries-heading" data-node-id="586:5737" data-industry-gallery data-playing={playback.playing} data-reduced-motion={playback.reducedMotion}>
      <p className={styles.eyebrow}>BUILT AROUND YOUR WORK</p>
      <h2 id="home-industries-heading" className={styles.heading}><span>Your trade.</span>{" "}<span>Your next good job.</span></h2>
      <p className={styles.introduction}>See how Renvani fits the work you do.</p>
      <div className={styles.controls}>
        {!playback.reducedMotion && (
          <button type="button" className={styles.outlineButton} onClick={playback.togglePaused} aria-controls="home-industry-cards">
            {playback.paused ? "Play animations" : "Pause animations"}
          </button>
        )}
        <p className={styles.motionNote}>Small moments. A smoother working day.</p>
      </div>
      <nav aria-label="Featured industries" className={styles.cardNavigation}>
        <div id="home-industry-cards" className={styles.cards} ref={playback.viewportRef} data-phase={playback.step}>
          {FEATURED_INDUSTRIES.map((card) => {
            const industry = INDUSTRY_PAGE_BY_SLUG[card.slug]!;
            const photo = INDUSTRY_PHOTOS[card.slug];
            const titleId = `home-industry-${card.slug}`;
            const outcomeId = `${titleId}-outcome`;

            return (
              <Link key={card.slug} href={industry.href} className={styles.card} aria-labelledby={titleId} aria-describedby={outcomeId} data-node-id={card.nodeId} data-industry-card={card.slug} data-phase={playback.step}>
                <Image src={photo.src} alt="" fill sizes="(min-width: 1440px) 411px, (min-width: 1200px) calc((100vw - 208px) / 3), (min-width: 960px) calc((100vw - 128px) / 3), (min-width: 600px) calc((100vw - 104px) / 2), calc(100vw - 40px)" className={styles.photo} style={{ objectPosition: photo.objectPosition }} data-industry-photo={card.slug} />
                <div className={styles.photoShade} aria-hidden="true" />
                <div className={styles.badge} data-node-id={card.badgeNodeId} aria-hidden="true">
                  <MiniOperation workflow={card.workflow} phase={playback.step} />
                  <div className={styles.badgeCopy}>
                    <p className={styles.qualifier}>{card.qualifier}</p>
                    <div className={styles.statusStack}>
                      {card.phases.map((status, phase) => <p key={status} className={styles.status} data-active={phase === playback.step}>{status}</p>)}
                    </div>
                  </div>
                </div>
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
