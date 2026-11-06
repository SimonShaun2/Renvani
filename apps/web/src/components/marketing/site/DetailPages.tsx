import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, ClipboardCheck, FileText, Plus, Repeat2 } from "lucide-react";
import type { ReactNode } from "react";
import { FigmaNode, type VNode } from "./FigmaNode";
import { ScaleToFrame } from "./ScaleToFrame";
import { FLAGSHIP_TREES } from "./flagship-visuals";
import { PRODUCT_PAGE_BY_SLUG, type ProductPageEntry } from "./flagship-registry";
import type { IndustryEntry } from "./industry-registry";
import { DETAIL_FEATURES, TRADE_HEADINGS, type DetailFeature } from "./detail-content";
import styles from "./detail-pages.module.css";

type Layer = Exclude<VNode, string>;
const VISUAL = /^(Product demonstration|Marketing visual|Editable product visual|Product example|Complementary product view|Feature workflow)\s*\//i;
export function detailVisual(slug: string, part: number, variant: "desktop" | "mobile") {
  const root = FLAGSHIP_TREES[slug]?.[variant];
  if (!root) throw new Error(`No illustration registered for ${slug}/${variant}`);
  const candidates: Layer[] = [];
  const collect = (node: VNode) => { if (typeof node === "string") return; if (VISUAL.test(node.n ?? "")) { candidates.push(node); return; } node.k?.forEach(collect); };
  collect(root);
  const node = candidates[part] ?? candidates[0];
  if (!node) throw new Error(`No isolated illustration for ${slug}/${variant}`);
  const width = Number(node.c?.match(/(?:^|\s)w-\[([\d.]+)px\]/)?.[1] ?? (variant === "mobile" ? 342 : 720));
  return { node, width };
}

export function DetailIllustration({ slug, part = 0, tone = 0 }: { slug: string; part?: number; tone?: number }) {
  const desktop = detailVisual(slug, part, "desktop");
  const mobile = detailVisual(slug, part, "mobile");
  return <figure className={styles.visualStage} data-tone={tone % 3} data-illustration={`${slug}:${part}`}>
    <div className={styles.visualCanvas} inert aria-hidden="true">
      <div className={styles.desktopArt}><ScaleToFrame width={desktop.width}><FigmaNode node={desktop.node} /></ScaleToFrame></div>
      <div className={styles.mobileArt}><ScaleToFrame width={mobile.width}><FigmaNode node={mobile.node} /></ScaleToFrame></div>
    </div><figcaption>Illustrative product view · Example data</figcaption>
  </figure>;
}

export function DetailAction({ href = "/demo", children = "Get a free demo", secondary = false }: { href?: string; children?: ReactNode; secondary?: boolean }) {
  return <Link href={href} className={`${styles.action} ${secondary ? styles.secondary : ""}`}>{children}<ArrowRight size={17} aria-hidden="true" /></Link>;
}

export function DetailHero({ category, title, body, children, overview = false }: { category: string; title: string; body: string; children?: ReactNode; overview?: boolean }) {
  return <section className={`${styles.hero} ${!children ? styles.centered : ""}`}>
    <div className={styles.heroCopy}><p className={styles.eyebrow}>{category}</p><h1>{title}</h1><p className={styles.lead}>{body}</p><div className={styles.actions}><DetailAction /><DetailAction href={overview ? "#plans" : "#features"} secondary>{overview ? "Compare plans" : "Explore the features"}</DetailAction></div></div>
    {children ? <div className={styles.heroMedia}>{children}</div> : null}
  </section>;
}

export function BenefitStrip({ items }: { items: readonly string[] }) {
  const icons = [CalendarDays, ClipboardCheck, Repeat2];
  return <div className={styles.benefitStrip} aria-label="At a glance">{items.map((item, index) => { const Icon = icons[index % icons.length]!; return <div key={item}><Icon size={23} strokeWidth={1.5} aria-hidden="true" /><span>{item}</span></div>; })}</div>;
}

export function FeatureSection({ feature, index, children }: { feature: DetailFeature; index: number; children?: ReactNode }) {
  return <section className={`${styles.feature} ${index % 2 ? styles.reversed : ""}`} id={`feature-${index + 1}`} data-detail-feature="">
    <div className={styles.featureCopy}><p className={styles.eyebrow}>{feature.label}</p><h2>{feature.title}</h2><p>{feature.body}</p><ul>{feature.points.map(point => <li key={point}><Check size={17} aria-hidden="true" /><span>{point}</span></li>)}</ul><Link className={styles.textLink} href="/demo">See it with your workflow<ArrowRight size={17} aria-hidden="true" /></Link></div>
    <div className={styles.featureMedia}>{children ?? <DetailIllustration slug={feature.visual} part={feature.part} tone={index + 1} />}</div>
  </section>;
}

export function DemoBand({ title = "Less chasing. More work moving.", body = "See how your services, team and customer journey come together in Renvani." }: { title?: string; body?: string }) {
  return <section className={styles.demoBand}><div><p className={styles.eyebrow}>SEE IT IN YOUR BUSINESS</p><h2>{title}</h2><p>{body}</p></div><DetailAction /></section>;
}

export function RelatedFeatures({ slugs, title = "The next part of the job is already connected." }: { slugs: readonly string[]; title?: string }) {
  const pages = [...new Set(slugs)].map(slug => PRODUCT_PAGE_BY_SLUG[slug]).filter((page): page is ProductPageEntry => !!page);
  return <section className={styles.related}><p className={styles.eyebrow}>CONNECTED FIELD SERVICE TOOLS</p><h2>{title}</h2><div className={styles.relatedGrid}>{pages.map(page => <Link href={`/product/${page.slug}`} key={page.slug}><span><strong>{page.name}</strong><small>{page.body}</small></span><ArrowUpRight size={22} aria-hidden="true" /></Link>)}</div></section>;
}

export function DetailFaq({ items }: { items: readonly { question: string; answer: string }[] }) {
  return <section className={styles.faqSection}><div><p className={styles.eyebrow}>A LITTLE MORE DETAIL</p><h2>Your questions, answered.</h2><p>Talk through the details that matter to your business.</p><Link href="/demo" className={styles.textLink}>Talk to Renvani<ArrowRight size={17} aria-hidden="true" /></Link></div><div>{items.map(item => <details key={item.question}><summary>{item.question}<Plus size={20} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></section>;
}

export function ProductDetailPage({ page }: { page: ProductPageEntry }) {
  const features = DETAIL_FEATURES[page.slug];
  if (!features) throw new Error(`Missing editorial detail page: ${page.slug}`);
  const related = features.map(f => f.visual).filter(slug => slug !== page.slug);
  const supplementary = related.length < 3 ? ["scheduling-dispatch", "estimates-approvals", "technician-app"].filter(slug => slug !== page.slug) : [];
  return <div className={styles.page} data-detail-page={page.slug} data-page-kind="product">
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/product">Products</Link><span>/</span><span>{page.name}</span></nav>
    <DetailHero category={page.template === "flagship" ? `RENVANI ${page.name}` : `${page.name} · FIELD SERVICE SOFTWARE`} title={page.headline} body={page.body}><DetailIllustration slug={page.slug} />{page.slug === "customer-portal" ? <p className={styles.previewNote}>Customer Portal is a preview. Confirm available actions in your demo.</p> : null}</DetailHero>
    <BenefitStrip items={features.map(f => f.label)} />
    <nav className={styles.pageNav} aria-label={`${page.name} page sections`}><a href="#features">Features</a><a href="#workflow">Connected workflow</a><a href="#questions">FAQs</a></nav>
    <div id="features"><header className={styles.sectionHeading}><p className={styles.eyebrow}>{page.name}</p><h2>Built for the details behind a good day.</h2><p>Take a closer look at what your team can do with {page.name.toLowerCase()}.</p></header>{features.map((feature, index) => <FeatureSection feature={feature} index={index} key={feature.title} />)}</div>
    <div id="workflow"><span id="workflow-m" /><DemoBand title={page.template === "flagship" ? `${page.name}, connected to the rest of your business.` : "A useful tool. Part of a bigger picture."} body="Growth, Revenue, Operations, Retention and Command Center remain Renvani’s five flagship products. Field service tools support the work behind them." /></div>
    <RelatedFeatures slugs={[...related, ...supplementary].slice(0, 3)} />
    <div id="questions"><DetailFaq items={[
      { question: `How does ${page.name} fit into Renvani?`, answer: page.template === "flagship" ? `${page.name} is one of Renvani’s five flagship products. Its supporting tools keep the customer, work and next action connected.` : `${page.name} is a supporting field service tool within Renvani, not a new flagship or separate product tier. Your existing services and workflow remain the starting point.` },
      { question: `What can I see in a ${page.name} demo?`, answer: `Walk through ${features.map(f => f.label.toLowerCase()).join(", ")} using an example of your work. The views on this page are illustrative, not live customer records.` },
      { question: "Can I keep my current business process?", answer: "Bring your services, team structure and current customer journey to the demo. Confirm required capabilities, specialized workflows and any preview availability before choosing a plan." },
      { question: "Who controls the next action?", answer: "Business policies and approval requirements continue to apply. Proposed messages and actions do not bypass customer consent, permissions or payment controls." }
    ]} /></div><DemoBand title={`See ${page.name} in action.`} />
  </div>;
}

const TRADE_IMAGES: Record<string, string> = { hvac: "/marketing/industries/illustrative-hvac-field-work-f1266660.jpg", plumbing: "/marketing/industries/illustrative-plumbing-field-work-5d7f94f5.jpg", electrical: "/marketing/industry-gallery/electrical-v1.webp", "appliance-repair": "/marketing/industry-gallery/appliance-repair-v1.webp", "pest-control": "/marketing/industry-gallery/pest-control-v1.webp", "tree-care": "/marketing/industry-gallery/tree-care-v1.webp" };

function TradeScene({ industry, kind }: { industry: IndustryEntry; kind: "estimate" | "field" | "history" }) {
  const ex = industry.example;
  const title = kind === "estimate" ? "Service estimate" : kind === "field" ? "Today’s visit" : "Customer history";
  return <figure className={styles.visualStage} data-tone={kind === "estimate" ? 0 : kind === "field" ? 1 : 2} data-trade-scene={kind}>
    <div className={styles.tradeScreen}><div className={styles.screenTop}><strong>Renvani</strong><span>{title}</span><small>EXAMPLE</small></div><div className={styles.screenBody}><p className={styles.screenEyebrow}>{industry.name}</p><h3>{ex.request}</h3>
      {kind === "estimate" ? <><div className={styles.scopeRows}>{ex.requestDetails.map((detail, index) => <div key={detail}><span>0{index + 1}</span><span>{detail}</span><Check size={16} aria-hidden="true" /></div>)}</div><div className={styles.screenHighlight}><FileText size={20} aria-hidden="true" /><span>{ex.estimate}</span></div><div className={styles.screenFooter}>Draft scope<span>Ready for review</span></div></> : kind === "field" ? <><div className={styles.visitSlot}><CalendarDays size={22} aria-hidden="true" /><div><strong>Assigned service visit</strong><span>Customer · Property · Approved scope</span></div></div><div className={styles.checklist}>{["Review the approved scope", "Keep the job notes together", "Add relevant job photos"].map(label => <div key={label}><CheckCircle2 size={20} aria-hidden="true" />{label}</div>)}</div><div className={styles.screenHighlight}>{ex.fieldWork}</div></> : <><div className={styles.history}>{["Original service request", "Estimate and approved work", "Completed visit and notes"].map((label, index) => <div key={label}><span>{index + 1}</span><div><strong>{label}</strong><p>{index === 0 ? ex.requestDetails[0] : index === 1 ? ex.estimate : ex.fieldWork}</p></div></div>)}</div><div className={styles.screenHighlight}><Repeat2 size={20} aria-hidden="true" /><span>{ex.nextVisit}</span></div></>}
    </div></div><figcaption>Illustrative workflow · Example service record</figcaption>
  </figure>;
}

export function IndustryDetailPage({ industry }: { industry: IndustryEntry }) {
  const headings = TRADE_HEADINGS[industry.slug];
  if (!headings) throw new Error(`Missing trade detail content: ${industry.slug}`);
  const ex = industry.example;
  const features = [
    { label: "Estimates and customer details", title: headings[0], body: `${ex.capture} ${ex.estimate}`, points: [...ex.requestDetails], visual: "estimates-approvals", part: 0 },
    { label: "Scheduling and field work", title: headings[1], body: `${ex.fieldWork} Give the team a shared visit record instead of a separate trail of messages.`, points: ["Keep the approved scope with the visit", "Connect the office and field", "Document the work as it happens"], visual: "technician-app", part: 0 },
    { label: "Service history and repeat business", title: headings[2], body: `${ex.nextVisit} Keep customer details and completed work ready for the next appropriate conversation.`, points: ["Keep the property’s service record", "Review the next follow-up", "Respect customer preferences and consent"], visual: "service-agreements", part: 0 }
  ];
  return <div className={styles.page} data-detail-page={industry.slug} data-page-kind="industry">
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/industries">Industries</Link><span>/</span><span>{industry.name}</span></nav>
    <DetailHero category={`${industry.name} SOFTWARE`} title={industry.headline} body={industry.description}>{TRADE_IMAGES[industry.slug] ? <figure className={styles.tradeHeroPhoto}><Image src={TRADE_IMAGES[industry.slug]!} alt={`Illustrative ${industry.name.toLowerCase()} field work`} fill priority sizes="(min-width: 1440px) 660px, (min-width: 960px) 48vw, 100vw" /><div className={styles.photoOverlay}><span className={styles.statusDot} /><div><small>YOUR NEXT GOOD JOB</small><strong>{ex.request}</strong></div><ArrowUpRight size={22} aria-hidden="true" /></div><figcaption>Illustrative field-work image</figcaption></figure> : <TradeScene industry={industry} kind="estimate" />}</DetailHero>
    <BenefitStrip items={["Make the scope clear", "Keep the crew connected", "Build on every visit"]} />
    <nav className={styles.pageNav} aria-label={`${industry.name} page sections`}><a href="#features">Built for your trade</a><a href="#tools">Your tools</a><a href="#questions">FAQs</a></nav>
    <div id="features"><header className={styles.sectionHeading}><p className={styles.eyebrow}>SOFTWARE FOR {industry.name}</p><h2>More time on the work.<br />Less time piecing it together.</h2><p>The details of {industry.name.toLowerCase()} work, connected from the first request to the next visit.</p></header>{features.map((feature, index) => <FeatureSection feature={feature} index={index} key={feature.title}><TradeScene industry={industry} kind={(["estimate", "field", "history"] as const)[index]!} /></FeatureSection>)}</div>
    <DemoBand title={`See a ${industry.name.toLowerCase()} job from start to finish.`} body="Start with a service request. Prepare an email or onsite estimate. Confirm the work, complete the visit, collect payment and review the next follow-up." />
    <div id="tools"><RelatedFeatures title="The tools behind your next good job." slugs={["estimates-approvals", "scheduling-dispatch", "technician-app", "invoices-payments", "customers-properties-assets", "service-agreements"]} /></div>
    <div id="questions"><DetailFaq items={[
      { question: `How does Renvani support ${industry.name.toLowerCase()} work?`, answer: `The example on this page follows ${ex.request.toLowerCase()}. ${ex.capture} ${ex.fieldWork}` },
      { question: "Can we estimate by email or onsite?", answer: "Either can be the starting point. Keep the proposed work clear, capture the approval, and confirm the scope before converting the estimate into the work order." },
      { question: "What about our specialized trade requirements?", answer: "Confirm required forms, certifications, equipment records, regulatory steps and integrations in your demo. These shared workflow examples are not a claim that every specialized trade capability is available." },
      { question: "How does this connect to the five flagship products?", answer: "Growth helps bring in the request, Revenue supports the estimate, Operations carries the visit, and Retention supports the relationship after the work. Command Center keeps the owner’s direction and review visible. The FSM tools support that journey." }
    ]} /></div><div className={styles.moreLinks}><Link href="/industries">All industries<ArrowRight size={16} aria-hidden="true" /></Link><Link href="/tour">Explore the product tour<ArrowRight size={16} aria-hidden="true" /></Link></div><DemoBand title="See your business in Renvani." />
  </div>;
}
