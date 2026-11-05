import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProductPageEntry } from "./flagship-registry";
import { ProductArtwork } from "./ProductArtwork";
import { PRODUCT_STORIES, SUBPAGE_FRAMES, SUITE_NAMES } from "./subpage-content";
import { Benefits, FinalCta, FlagshipCards, RelatedTools, SectionHeading, SubpageFaq, SubpageHero } from "./SubpageShared";
import { SubpageJourney } from "./SubpageJourney";
import styles from "./subpage.module.css";

/** Shared responsive template; every existing product route retains its own content and canonical product artwork. */
export function FlagshipPage({ page }: { page: ProductPageEntry }) {
  const story = PRODUCT_STORIES[page.slug];
  if (!story) throw new Error(`Missing product story: ${page.slug}`);
  const flagship = page.template === "flagship";
  const suiteName = SUITE_NAMES[story.suite];
  return <div className={styles.page} data-node-id={SUBPAGE_FRAMES[flagship ? "flagship" : "tool"].desktop} data-marketing-template={flagship ? "flagship" : "tool"}>
    <SubpageHero eyebrow={flagship ? `RENVANI ${page.name}` : `${suiteName} / FIELD SERVICE TOOLS`} title={page.headline} description={page.body}>
      <figure><ProductArtwork slug={page.slug} /><figcaption className={styles.caption}>Illustrative product view · Example business and data{page.slug === "customer-portal" ? " · Preview" : ""}</figcaption></figure>
    </SubpageHero>
    <Benefits items={story.benefits} />
    <section id="workflow" className={`${styles.section} ${styles.white}`}>
      <SectionHeading eyebrow={flagship ? "FROM DIRECTION TO THE NEXT STEP" : "THE WORK, WITHOUT THE GAPS"} title={flagship ? `${page.name}, in the flow of your business.` : `See ${page.name.toLowerCase()} in the flow of a job.`} description="Follow one connected example. Choose a step to take a closer look." />
      <SubpageJourney name={page.name} steps={story.steps.map((title,index) => ({title,body:story.details[index]!}))} artwork={<ProductArtwork slug={page.slug} />} />
    </section>
    <section className={styles.section} aria-labelledby="connected-products-title">
      <div className={styles.copy}>{!flagship ? <Link className={styles.parentBadge} href={`/product/${story.suite}`}>Part of Renvani {suiteName}<ArrowRight size={14} aria-hidden="true" /></Link> : null}<p className={styles.eyebrow}>ONE CONNECTED PLATFORM</p><h2 className={styles.h2} id="connected-products-title">{flagship ? "Strong on its own. Better connected." : "The tool supports the outcome."}</h2><p className={styles.body}>{flagship ? "Growth, Revenue, Operations and Retention keep the work connected. Command Center keeps the owner in control." : `${page.name} supports ${suiteName}. Your field service tools carry the work through the five flagship products, rather than creating another disconnected workflow.`}</p></div>
      <div style={{marginTop:32}}><FlagshipCards /></div><RelatedTools suite={story.suite} current={page.slug} />
    </section>
    <SubpageFaq items={[
      {question:`How does ${page.name} fit into Renvani?`,answer:flagship ? `${page.name} is one of Renvani’s five flagship products. It connects to the surrounding inquiry, service and follow-up records so the next step keeps its context.` : `${page.name} is a supporting field service tool within ${suiteName}. It is part of the connected Renvani platform, not a separate flagship product.`},
      {question:"What stays under the owner’s control?",answer:"Business policies, approval requirements and exceptions remain visible. Proposed actions do not bypass permissions, customer consent or financial controls."},
      {question:page.slug === "customer-portal" ? "Is the customer portal available now?" : "Can I see this with my own workflow?",answer:page.slug === "customer-portal" ? "This page presents a preview of the proposed portal experience. Ask which customer-facing actions are available for your business during the demo." : "Yes. Request a demo to walk through your services, team and current process. The product views on this page use illustrative example data, not a customer result or performance guarantee."}
    ]} />
    <FinalCta title={flagship ? `Put ${page.name} to work for your business.` : "See the whole job come together."} />
  </div>;
}
