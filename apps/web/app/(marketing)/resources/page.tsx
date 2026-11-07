import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardList } from "lucide-react";
import { ResourceLibrary } from "@/src/components/marketing/resources/ResourceLibrary";
import { articleCards, PLAYBOOK_COPY, templateCards } from "@/src/lib/resources/playbook";
import { withMarketingSeo } from "@/src/lib/seo/marketing-metadata";
import { fetchCmsList } from "@/src/sanity/fetch";
import { CmsReadError } from "@/src/sanity/read-result";
import styles from "@/src/components/marketing/resources/playbook.module.css";

export const revalidate = 60;
export const metadata = withMarketingSeo("/resources", { title: PLAYBOOK_COPY.title, description: PLAYBOOK_COPY.description });

export default async function ResourcesPage() {
  let articles: ReturnType<typeof articleCards> = [];
  let articlesUnavailable = false;
  try { articles = articleCards(await fetchCmsList("post")); }
  catch (error) {
    // Preserve useful static tools during a provider outage. Do not label the outage as no published content.
    if (!(error instanceof CmsReadError)) throw error;
    articlesUnavailable = true;
  }
  return <div className={styles.page}>
    <section className={styles.hero} aria-labelledby="playbook-title">
      <div><p className={styles.eyebrow}>{PLAYBOOK_COPY.name}</p><h1 id="playbook-title">Build a better<br /><em>service business.</em></h1><p className={styles.lede}>{PLAYBOOK_COPY.description}</p>
        <a href="#library" className={styles.primary}>Explore the Playbook <ArrowRight size={18} aria-hidden="true" /></a>
        <p className={styles.heroNote}>For the people behind the trucks, the teams, and the next good job.</p>
      </div>
      <aside className={styles.feature} aria-label="Featured resource">
        <span className={styles.featureIcon}><ClipboardList size={29} aria-hidden="true" /></span><p className={styles.eyebrow}>A CLEARER DAY STARTS HERE</p><h2>Less scrambling.<br />A better handoff.</h2><p>Give the office and the field the same plan with a ready-to-use dispatch checklist.</p>
        <Link href="/resources/templates/daily-dispatch-checklist">Get the checklist <ArrowRight size={18} aria-hidden="true" /></Link>
      </aside>
    </section>
    <div className={styles.valueStrip}><span><BookOpen size={18} aria-hidden="true" />Practical, not theoretical.</span><span><ClipboardList size={18} aria-hidden="true" />Useful with or without Renvani.</span><span>No sign-up to use the templates.</span></div>
    {articlesUnavailable ? <p className={styles.notice} role="status">Articles are temporarily unavailable. The templates below are still available.</p> : null}
    <ResourceLibrary resources={[...templateCards(), ...articles]} />
    <section className={styles.nextStep} aria-labelledby="playbook-next"><div><p className={styles.eyebrow}>FROM THE IDEA TO THE EVERYDAY</p><h2 id="playbook-next">Connect the work<br />behind your next good job.</h2><p>Explore how Renvani brings booking requests, estimates, scheduling, field work, and customer follow-up together.</p></div><Link href="/how-it-works" className={styles.primary}>See how it works <ArrowRight size={18} aria-hidden="true" /></Link></section>
  </div>;
}
