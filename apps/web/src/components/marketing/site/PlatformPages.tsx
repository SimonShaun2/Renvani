import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { HomeWorkflowId } from "./home-workflows";
import { HomepageWorkflows } from "./HomepageWorkflows";
import { ProductArtwork } from "./ProductArtwork";
import { PRODUCT_PAGES } from "./flagship-registry";
import { PRODUCT_STORIES, SUBPAGE_FRAMES, SUITE_NAMES } from "./subpage-content";
import { Benefits, FinalCta, FlagshipCards, SectionHeading, SubpageFaq, SubpageHero } from "./SubpageShared";
import styles from "./subpage.module.css";

export function ProductsPage() {
  return <div className={styles.page} data-marketing-template="product-directory">
    <SubpageHero eyebrow="THE RENVANI PLATFORM" title="Five products. One connected business." description="Grow the demand. Win the work. Run the job. Bring customers back. Keep the owner in control." secondary={{label:"Explore the platform",href:"#flagships"}} />
    <section className={styles.section} id="flagships"><SectionHeading eyebrow="START WITH THE OUTCOME" title="The products that move your business forward." /><FlagshipCards /></section>
    <section className={`${styles.section} ${styles.white}`} id="tools"><SectionHeading eyebrow="FIELD SERVICE TOOLS" title="Everything behind a great service business." description="The FSM tools are the supporting layer. Each one helps the flagship products carry the work from one step to the next." />
      <div className={styles.toolGroups}>{(Object.keys(SUITE_NAMES) as HomeWorkflowId[]).map(suite => <section className={styles.toolGroup} data-tool-group={suite} key={suite} aria-labelledby={`tools-${suite}`}><h3 id={`tools-${suite}`}>{SUITE_NAMES[suite]}</h3>{PRODUCT_PAGES.filter(page => page.template!=="flagship"&&PRODUCT_STORIES[page.slug]?.suite===suite).map(page=><Link key={page.slug} href={`/product/${page.slug}`}>{page.name}{page.slug==="customer-portal"?" · Preview":""}<ArrowUpRight size={16} aria-hidden="true" /></Link>)}</section>)}</div>
    </section><FinalCta />
  </div>;
}

const howSteps = [
  ["Choose the business goal", "Set your profile and an Operating Mission, such as getting more bookings. Your services and service area provide the starting point."],
  ["Get found. Receive the request.", "Connect discovery to a clear service request. The inquiry brings its source and customer details with it."],
  ["Prepare the estimate", "Use an email estimate or schedule an onsite estimate. Keep the proposed work and your prices clear."],
  ["Confirm the scope. Create the job.", "Confirm and approve the work before converting the estimate into the work order and assigning the visit."],
  ["Run the visit. Complete payment.", "The technician follows the job, records photos and materials, then completes the invoice and configured payment workflow."],
  ["Build the next visit", "Use the completed record for a review invitation, membership or maintenance follow-up. Review and consent requirements stay in place."]
] as const;

export function HowItWorksPage() {
  return <div className={styles.page} data-marketing-template="how-it-works" data-node-id={SUBPAGE_FRAMES.how.desktop}>
    <SubpageHero eyebrow="ONE CONNECTED BUSINESS" title="Set the goal. Keep the work moving." description="From getting found to getting paid and bringing customers back. Five products keep the handoffs connected, with you in control." secondary={{label:"Follow a job",href:"#workflow"}}><figure><ProductArtwork slug="command-center" /><figcaption className={styles.caption}>Illustrative owner workflow · Example business and data</figcaption></figure></SubpageHero>
    <Benefits items={["Choose your mission", "Review the next move", "Follow the job through"]} />
    <section id="workflow" className={`${styles.section} ${styles.white}`}><SectionHeading eyebrow="A REAL-WORLD SERVICE JOURNEY" title="One job. Connected from start to finish." description="An illustrative journey through your business, not a set of isolated screens." /><div className={styles.howSteps}>{howSteps.map(([title,body],index)=><article key={title} className={styles.howStep}><span>0{index+1}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <HomepageWorkflows />
    <section className={`${styles.section} ${styles.dark}`}><div className={styles.copy}><p className={styles.eyebrow}>YOU SET THE DIRECTION</p><h2 className={styles.h2}>The business moves. You stay in control.</h2><p className={styles.body}>Command Center brings the proposed next move, the record behind it and the approval together. The system does not skip your policies, permissions or customer consent.</p><Link href="/product/command-center" className={`${styles.button} ${styles.outlineButton}`}>Explore Command Center<ArrowUpRight size={17} aria-hidden="true" /></Link></div></section>
    <SubpageFaq items={[
      {question:"Where does a new business start?",answer:"Start with your business profile, services, service area and goal. Review the available records and opportunities with the team so your first workflow has useful context."},
      {question:"Is every action automatic?",answer:"No. Renvani follows business policies and approval requirements. The owner reviews the actions and exceptions that need a decision; messages and financial actions keep their separate controls."},
      {question:"Does this replace the field service tools?",answer:"No. Scheduling, estimates, job records, field workflows and invoicing support the five flagship products. They are the tools that carry out and record the work."}
    ]} /><FinalCta />
  </div>;
}
