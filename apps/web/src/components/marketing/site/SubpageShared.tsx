import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, LayoutDashboard, Megaphone, Plus, Repeat2, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import type { HomeWorkflowId } from "./home-workflows";
import { PRODUCT_PAGES } from "./flagship-registry";
import { PRODUCT_STORIES, SUITE_NAMES } from "./subpage-content";
import styles from "./subpage.module.css";

export function SubpageHero({ eyebrow, title, description, children, secondary = { label: "See the workflow", href: "#workflow" } }: { eyebrow: string; title: string; description: string; children?: ReactNode; secondary?: { label: string; href: string } }) {
  return <section className={`${styles.hero} ${children ? "" : styles.heroCentered}`} aria-labelledby="subpage-title">
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>{eyebrow}</p><h1 id="subpage-title" className={styles.title}>{title}</h1><p className={styles.lead}>{description}</p>
      <div className={styles.actions}><Link href="/demo" className={styles.button}>Get a free demo<ArrowRight size={17} aria-hidden="true" /></Link><Link href={secondary.href} className={`${styles.button} ${styles.lightButton}`}>{secondary.label}</Link></div>
    </div>
    {children ? <div className={styles.heroMedia}>{children}</div> : null}
  </section>;
}

export function Benefits({ items }: { items: readonly string[] }) {
  return <section className={styles.benefits} aria-label="At a glance">{items.map(item => <div className={styles.benefit} key={item}><CheckCircle2 aria-hidden="true" /><h2>{item}</h2></div>)}</section>;
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className={styles.sectionHead}><p className={styles.eyebrow}>{eyebrow}</p><h2 className={styles.h2}>{title}</h2>{description ? <p className={styles.body}>{description}</p> : null}</div>;
}

const productIcons = { growth: Megaphone, revenue: TrendingUp, operations: CalendarDays, retention: Repeat2, "command-center": LayoutDashboard };
const productDescriptions = { growth: "Get found. Get booked.", revenue: "Turn inquiries into approved work.", operations: "Keep the whole job moving.", retention: "Give customers a reason to return.", "command-center": "Set the direction. Review the next move." };

export function FlagshipCards() {
  return <nav className={styles.productGrid} aria-label="Five flagship products">{(Object.keys(SUITE_NAMES) as HomeWorkflowId[]).map(id => {
    const Icon = productIcons[id];
    return <Link key={id} href={`/product/${id}`} className={`${styles.productCard} ${id === "command-center" ? styles.commandCard : ""}`}><Icon aria-hidden="true" /><strong>{SUITE_NAMES[id]}</strong><p>{productDescriptions[id]}</p></Link>;
  })}</nav>;
}

export function RelatedTools({ suite, current }: { suite: HomeWorkflowId; current?: string }) {
  const related = PRODUCT_PAGES.filter(p => p.template !== "flagship" && p.slug !== current && PRODUCT_STORIES[p.slug]?.suite === suite).slice(0,3);
  if (!related.length) return null;
  return <nav className={styles.related} aria-label="Related tools">{related.map(p => <Link key={p.slug} href={`/product/${p.slug}`}>{p.name}<ArrowUpRight size={18} aria-hidden="true" /></Link>)}</nav>;
}

export type FaqEntry = { question: string; answer: string };
export function SubpageFaq({ items }: { items: readonly FaqEntry[] }) {
  return <section className={`${styles.section} ${styles.white}`} aria-labelledby="subpage-faq-title"><div className={styles.faqLayout}>
    <div className={styles.copy}><p className={styles.eyebrow}>QUESTIONS, ANSWERED</p><h2 id="subpage-faq-title" className={styles.h2}>A few things to know.</h2><Link className={styles.link} href="/demo">Talk through your workflow<ArrowRight size={17} aria-hidden="true" /></Link></div>
    <div className={styles.faqList}>{items.map(item => <details className={styles.faq} key={item.question}><summary>{item.question}<Plus size={20} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div>
  </div></section>;
}

export function FinalCta({ title = "See your business connected.", description = "Walk through the work you do, with the tools that keep it moving." }: { title?: string; description?: string }) {
  return <section className={`${styles.section} ${styles.dark} ${styles.cta}`} aria-label="Your next step"><div className={styles.copy}><p className={styles.eyebrow}>YOUR NEXT STEP</p><h2 className={styles.h2}>{title}</h2><p className={styles.body}>{description}</p></div><Link href="/demo" className={styles.button}>Get a free demo<ArrowRight size={18} aria-hidden="true" /></Link></section>;
}
