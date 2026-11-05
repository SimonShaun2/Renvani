import Image from "next/image";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { IndustryEntry, IndustrySlug } from "./industry-registry";
import { IndustryIcon } from "./IndustryIcon";
import { Benefits, FinalCta, FlagshipCards, SectionHeading, SubpageFaq, SubpageHero } from "./SubpageShared";
import { SubpageJourney } from "./SubpageJourney";
import { SUBPAGE_FRAMES } from "./subpage-content";
import styles from "./subpage.module.css";

export const TRADE_PHOTOS: Partial<Record<IndustrySlug, string>> = {
  hvac: "/marketing/industries/illustrative-hvac-field-work-f1266660.jpg",
  plumbing: "/marketing/industries/illustrative-plumbing-field-work-5d7f94f5.jpg",
  electrical: "/marketing/industry-gallery/electrical-v1.webp",
  "appliance-repair": "/marketing/industry-gallery/appliance-repair-v1.webp",
  "pest-control": "/marketing/industry-gallery/pest-control-v1.webp",
  "tree-care": "/marketing/industry-gallery/tree-care-v1.webp"
};

/** All fourteen trades share responsive structure, not generic trade copy or unsupported specialized-feature claims. */
export function IndustryWorkflowPage({ industry }: { industry: IndustryEntry }) {
  const photo = TRADE_PHOTOS[industry.slug];
  const ex = industry.example;
  return <div className={styles.page} data-node-id={SUBPAGE_FRAMES.industry.desktop} data-marketing-template="industry" data-industry-page={industry.slug}>
    <SubpageHero eyebrow={`RENVANI FOR ${industry.name}`} title={industry.headline} description={industry.description}>
      {photo ? <figure><div className={styles.heroPhoto}><Image src={photo} alt="" fill sizes="(min-width: 1440px) 665px, (min-width: 960px) 48vw, 100vw" priority /><div className={styles.photoLabel}><IndustryIcon slug={industry.slug} /><span>{industry.tagline}</span></div></div><figcaption className={styles.caption}>Illustrative field-work image</figcaption></figure> : <div className={styles.tradePanel}><div className={styles.tradePanelHead}><IndustryIcon slug={industry.slug} size={28} /><span className={styles.example}>Illustrative workflow</span></div><p className={styles.tradeTitle}>{ex.request}</p><div className={styles.tradeFields}>{ex.requestDetails.map(detail => <div className={styles.tradeField} key={detail}>{detail}</div>)}</div><div className={styles.tradeState}><CheckCircle2 size={18} aria-hidden="true" /><span>One connected service record</span></div></div>}
    </SubpageHero>
    <Benefits items={["Capture the right details", "Keep approved work connected", "Make the next visit easier"]} />
    <section id="workflow" className={`${styles.section} ${styles.white}`}>
      <SectionHeading eyebrow={`AN EXAMPLE FROM ${industry.name}`} title="Built around the way your work moves." description="From the first request to the next visit. The context travels with the job." />
      <SubpageJourney name={industry.name} steps={[
        {title:"Start with the request",body:ex.capture,record:{title:ex.request,fields:ex.requestDetails,status:"Request ready for review"}},
        {title:"Confirm the scope. Run the visit.",body:ex.estimate,record:{title:"A clear scope for the visit",fields:[ex.estimate,ex.fieldWork],status:"Approved work stays with the job"}},
        {title:"Finish well. Plan what comes next.",body:ex.nextVisit,record:{title:"The relationship continues",fields:[ex.fieldWork,ex.nextVisit],status:"Review the follow-up before sending"}}
      ]} />
    </section>
    <section className={styles.section}><SectionHeading eyebrow="MORE THAN A FIELD SERVICE TOOL" title={`A connected business, built around ${industry.name.toLowerCase()}.`} description="Your field service tools carry out the work. Five flagship products keep growth, revenue, operations and the customer relationship moving together." /><FlagshipCards /><div className={styles.actions} style={{marginTop:24}}><Link className={styles.link} href="/tour">Explore the product tour</Link><Link className={styles.link} href="/industries">All industries</Link></div></section>
    <SubpageFaq items={[
      {question:`How can Renvani fit a ${industry.name.toLowerCase()} business?`,answer:`Start with the services you offer and the way requests become jobs. This example follows ${ex.request.toLowerCase()} through the connected request, estimate, visit and follow-up workflow.`},
      {question:"Can an estimate happen by email or onsite?",answer:"The journey supports either starting point. Keep the proposed scope clear, capture the approval and confirm the work before converting it into the job. Walk through your specific process in the demo."},
      {question:"Does this include every specialized tool for my trade?",answer:"These pages illustrate shared service workflows, not a promise of every trade-specific feature. Confirm your required forms, equipment records, compliance steps and specialized integrations with the team before choosing a plan."},
      {question:"Who approves messages and the next action?",answer:"The owner’s policies and approval rules govern the next move. Customer communications remain subject to the applicable consent and review requirements."}
    ]} />
    <FinalCta title={`See Renvani in your ${industry.name.toLowerCase()} workflow.`} />
  </div>;
}
