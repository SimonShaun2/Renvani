import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ArrowRight } from "lucide-react";
import { findTemplate, PLAYBOOK_TEMPLATES, templatePath } from "@/src/lib/resources/playbook";
import { withMarketingSeo } from "@/src/lib/seo/marketing-metadata";
import styles from "@/src/components/marketing/resources/playbook.module.css";

export const dynamicParams = false;
export function generateStaticParams() { return PLAYBOOK_TEMPLATES.map(({ slug }) => ({ slug })); }
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const template = findTemplate((await params).slug);
  return template ? withMarketingSeo(templatePath(template.slug), { title: `${template.title} | The Renvani Playbook`, description: template.description }) : { robots: { index: false, follow: false } };
}
export default async function TemplatePage({ params }: Props) {
  const template = findTemplate((await params).slug);
  if (!template) notFound();
  return <article className={`${styles.page} ${styles.article}`}>
    <nav aria-label="Breadcrumb"><Link href="/resources">The Renvani Playbook</Link><span aria-hidden="true"> / </span><span>Templates & checklists</span></nav>
    <header><p className={styles.eyebrow}>FREE TEMPLATE · {template.topic}</p><h1>{template.title}</h1><p className={styles.lede}>{template.description}</p><a className={styles.primary} href={`${templatePath(template.slug)}/download`} download={`${template.slug}.txt`}><Download size={18} aria-hidden="true" /> Download editable text</a><p className={styles.heroNote}>No form. No account. Open the .txt file in any text editor.</p></header>
    <p className={styles.introduction}>{template.introduction}</p>
    {template.sections.map((section, index) => <section className={styles.templateSection} key={section.title} aria-labelledby={`section-${index}`}><h2 id={`section-${index}`}>{section.title}</h2><pre>{section.text}</pre></section>)}
    <div className={styles.templateFooter}><Link href="/resources">← Back to the Playbook</Link><Link href={template.product.href}>{template.product.label}<ArrowRight size={17} aria-hidden="true" /></Link></div>
  </article>;
}
