import { DetailAction } from "./DetailPages";
import { FOUNDER_STORY } from "./launch-content";
import styles from "./founder-story.module.css";

export function AboutPage() {
  return <article className={styles.about} data-node-id={FOUNDER_STORY.nodes.aboutDesktop}>
    <p className={styles.eyebrow}>{FOUNDER_STORY.eyebrow}</p>
    <h1 className={styles.aboutTitle}>Built for the work.<br />Built around the owner.</h1>
    <p className={styles.aboutLead}>{FOUNDER_STORY.lead}</p>
    <p className={styles.body}>{FOUNDER_STORY.context}</p>
    <p className={styles.body}>{FOUNDER_STORY.purpose}</p>
    <section className={styles.principles} aria-labelledby="about-platform-title">
      <h2 id="about-platform-title">From the goal to the next good job.</h2>
      {FOUNDER_STORY.principles.map(item => <div className={styles.principle} key={item.title}><h3>{item.title}</h3><p className={styles.body}>{item.body}</p></div>)}
    </section>
    <DetailAction href="/tour">See the product tour</DetailAction>
  </article>;
}
