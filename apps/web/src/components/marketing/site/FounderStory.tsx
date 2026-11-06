import { FOUNDER_STORY } from "./launch-content";
import styles from "./founder-story.module.css";

/** Editorial founder experience, not a customer testimonial or endorsement. */
export function FounderStory() {
  return (
    <section className={styles.section} aria-labelledby="founder-story-title" data-node-id={FOUNDER_STORY.nodes.desktop} data-founder-story="">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{FOUNDER_STORY.eyebrow}</p>
        <h2 id="founder-story-title" className={styles.title}>
          {FOUNDER_STORY.title[0]}
          <br />
          {FOUNDER_STORY.title[1]}
        </h2>
        <p className={styles.body}>{FOUNDER_STORY.lead}</p>
        <p className={styles.body}>{FOUNDER_STORY.summary}</p>
      </div>
      <aside className={styles.credibility} aria-label="Founder field service experience">
        <p className={styles.cardEyebrow}>{FOUNDER_STORY.cardEyebrow}</p>
        <p className={styles.cardTitle}>
          {FOUNDER_STORY.cardTitle[0]}
          <br />
          {FOUNDER_STORY.cardTitle[1]}
        </p>
        <p className={styles.attribution}>
          Shaun Simon
          <br />
          Founder of Renvani
        </p>
      </aside>
    </section>
  );
}
