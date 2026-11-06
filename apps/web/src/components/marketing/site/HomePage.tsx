import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { ClickToPlayVideo } from "./ClickToPlayVideo";
import { HomepageWorkflows } from "./HomepageWorkflows";
import { LoopVideo } from "./LoopVideo";
import { MEDIA } from "./media-loops";
import { IndustryShowcase } from "./IndustryShowcase";
import { GROWTH_CHECK_ENTRY } from "./site-config";
import styles from "./homepage.module.css";

/** The existing website-to-Growth-Check handoff, now in the lower homepage section. */
export function GrowthCheckEntry({ id, className = "" }: { id: string; className?: string }) {
  return (
    <form action={GROWTH_CHECK_ENTRY.action} method="get" className={`${styles.growthForm} ${className}`} aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={id} className={styles.eyebrow}>{GROWTH_CHECK_ENTRY.label}</label>
      <input id={id} name="website" type="text" inputMode="url" autoComplete="url" placeholder={GROWTH_CHECK_ENTRY.placeholder} className={styles.websiteInput} />
      <button type="submit" className={`${styles.button} ${styles.amberButton}`}>{GROWTH_CHECK_ENTRY.submit}<ArrowRight size={17} aria-hidden="true" /></button>
      <Link href={GROWTH_CHECK_ENTRY.secondary.href} className={styles.textLink}>{GROWTH_CHECK_ENTRY.secondary.label}</Link>
    </form>
  );
}

/** Canonical revised proposal578:5186; responsive, semantic adaptation of its editable sections. */
export function HomePage() {
  return (
    <div className={styles.home} data-node-id="578:5186">
      <section className={styles.hero} aria-labelledby="home-hero" data-node-id="578:5188">
        <div className={styles.heroPhoto} data-node-id="578:5189">
          <LoopVideo {...MEDIA.hero} alt="" priority sizes="(min-width: 1440px) 960px, (min-width: 960px) 67vw, 100vw" className={styles.heroImage} frameClassName="absolute inset-0 h-full w-full" />
        </div>
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>FOR HOME &amp; FIELD SERVICE BUSINESSES</p>
          <h1 id="home-hero" className={styles.heroTitle}><span>More jobs.</span>{" "}<span>Less on your</span>{" "}<span>shoulders.</span></h1>
          <p className={styles.heroDescription}>Renvani connects getting found, booking work, running the job and bringing customers back.</p>
          <div className={styles.heroActions}>
            <Link href="#product-workflows" className={`${styles.button} ${styles.amberButton}`}>See Renvani in action</Link>
            <Link href="/growth-check" className={`${styles.button} ${styles.lightButton}`}>Get my growth report</Link>
          </div>
        </div>
      </section>

      <HomepageWorkflows />

      <section className={styles.missions} aria-labelledby="home-missions" data-node-id="578:5216">
        <div className={styles.missionIntroduction}>
          <p className={styles.eyebrow}>OPERATING MISSIONS</p>
          <h2 id="home-missions" className={styles.sectionTitle}>Set the goal.<br />See the next move.</h2>
          <p className={styles.missionDescription}>Choose the outcome. Review a clear next step. Keep the final decision with you.</p>
          <Link href="/product/command-center" className={styles.missionLink}>See how Operating Missions could work<ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
        <figure className={styles.missionFigure}>
          <div className={styles.missionCard} role="img" aria-label="Illustrative mission: Get more bookings. Prepare a local outreach campaign. Owner review is required before anything is sent." data-node-id="578:5223">
            <div aria-hidden="true" className={styles.missionCardContent}>
              <div>
                <p className={styles.smallLabel}>YOUR GOAL</p>
                <p className={styles.goalTitle}>Get more bookings</p>
              </div>
              <div className={styles.suggestedMove}>
                <p className={styles.smallLabel}>SUGGESTED NEXT MOVE</p>
                <p className={styles.moveTitle}>Prepare a local outreach campaign</p>
                <p className={styles.moveDescription}>Review the message, audience and service area before anything is sent.</p>
              </div>
              <div className={styles.missionActions}>
                <span className={styles.reviewStatus}>Owner review</span>
                <span className={styles.previewAction}>Review next move</span>
              </div>
            </div>
          </div>
          <figcaption>Proposed experience · Illustrative workflow</figcaption>
        </figure>
      </section>

      <IndustryShowcase />


      <section className={styles.whySection} aria-labelledby="home-why" data-node-id="why-renvani-video">
        <div className={styles.whyInner}>
          <h2 id="home-why" className={styles.sectionTitle}>Why we built Renvani</h2>
          <ClickToPlayVideo
            src={MEDIA.why.src}
            poster={MEDIA.why.poster}
            captionsSrc={MEDIA.why.captions}
            title="Why we built Renvani"
            className={styles.whyVideo}
          />
          <Link href="/demo" className={`${styles.button} ${styles.amberButton} ${styles.whyCta}`}>Book a demo</Link>
        </div>
      </section>

      <section className={styles.growthSection} aria-labelledby="home-growth-check" data-node-id="586:5761">
        <div className={styles.growthIntroduction}>
          <p className={styles.eyebrow}>YOUR NEXT STEP</p>
          <h2 id="home-growth-check" className={styles.sectionTitle}>See what your website could do better.</h2>
          <p>A few clear opportunities. A useful place to start.</p>
        </div>
        <GrowthCheckEntry id="growth-check-home" />
      </section>
    </div>
  );
}
