"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowUpRight, BookOpen, ClipboardList, Search } from "lucide-react";
import { filterResources, type ResourceCard, type ResourceKind } from "@/src/lib/resources/playbook";
import styles from "./playbook.module.css";

/** Initial cards are server-rendered; search enhances real links without generating extra index URLs. */
export function ResourceLibrary({ resources }: { resources: ResourceCard[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ResourceKind | "all">("all");
  const shown = filterResources(resources, query, kind);
  const hasArticles = resources.some(resource => resource.kind === "article");
  return <section id="library" className={styles.library} aria-labelledby={`${id}-title`}>
    <div className={styles.sectionHeading}>
      <div><p className={styles.eyebrow}>PUT IT TO WORK</p><h2 id={`${id}-title`}>Find your next useful idea.</h2></div>
      <p>Start with a question. Leave with a next step.</p>
    </div>
    <div className={styles.controls}>
      <div className={styles.search}>
        <label htmlFor={`${id}-search`}>Search the Playbook</label>
        <div><Search size={19} aria-hidden="true" /><input id={`${id}-search`} type="search" placeholder="Try estimates, dispatch, or follow-up" value={query} onChange={event => setQuery(event.target.value)} /></div>
      </div>
      <div className={styles.filters} role="group" aria-label="Resource format">
        {([['all', 'All resources'], ['template', 'Templates & checklists'], ...(hasArticles ? [['article', 'Articles & guides']] : [])] as const).map(([value, label]) =>
          <button key={value} type="button" aria-pressed={kind === value} onClick={() => setKind(value as ResourceKind | "all")}>{label}</button>)}
      </div>
    </div>
    <p className={styles.resultCount} role="status" aria-live="polite">{shown.length} {shown.length === 1 ? "resource" : "resources"}</p>
    {shown.length ? <ul className={styles.cards}>{shown.map(resource => <li key={resource.href}>
      <Link href={resource.href} className={styles.card}>
        <span className={styles.cardTop}>{resource.kind === "template" ? <ClipboardList size={23} aria-hidden="true" /> : <BookOpen size={23} aria-hidden="true" />}<ArrowUpRight size={20} aria-hidden="true" /></span>
        <span className={styles.eyebrow}>{resource.kind === "template" ? "FREE TEMPLATE" : "ARTICLE & GUIDE"}</span>
        <h3>{resource.title}</h3><p>{resource.description}</p>
        <span className={styles.cardBottom}>{resource.topic}<span aria-hidden="true">→</span></span>
      </Link>
    </li>)}</ul> : <div className={styles.noResults}><h3>No matching resources.</h3><p>Try a broader search or a different format.</p><button type="button" onClick={() => { setQuery(""); setKind("all"); }}>Clear filters</button></div>}
    <noscript><p>All resources are listed above. Search and format filters require JavaScript.</p></noscript>
  </section>;
}
