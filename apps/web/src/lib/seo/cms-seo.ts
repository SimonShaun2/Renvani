import type { Metadata } from "next";

import type { CmsDoc } from "@/src/sanity/fetch";
import { CMS_TYPES, type CmsType } from "@/src/sanity/env";
import { publicSiteUrl } from "./public-sitemap";

export function cmsPath(type: CmsType, slug: string): string {
  return `${CMS_TYPES[type]}/${encodeURIComponent(slug)}`;
}

/** Absolute when PUBLIC_SITE_URL is set; otherwise the site-relative path. */
export function canonicalUrl(path: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = publicSiteUrl(env);
  return base ? `${base}${path}` : path;
}

export function cmsMetadata(type: CmsType, doc: CmsDoc, env: NodeJS.ProcessEnv = process.env): Metadata {
  const title = doc.seoTitle || `${doc.title} · Renvani`;
  const description = doc.metaDescription ?? undefined;
  const url = canonicalUrl(cmsPath(type, doc.slug), env);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "Renvani",
      ...(doc.publishedAt ? { publishedTime: doc.publishedAt } : {}),
      ...(doc.ogImageUrl ? { images: [{ url: doc.ogImageUrl }] } : {})
    }
  };
}

type JsonLd = Record<string, unknown>;

/** Article for every CMS page, plus FAQPage when the document has FAQ items. */
export function cmsJsonLd(type: CmsType, doc: CmsDoc, env: NodeJS.ProcessEnv = process.env): JsonLd[] {
  const url = canonicalUrl(cmsPath(type, doc.slug), env);
  const article: JsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: doc.seoTitle || doc.title,
    ...(doc.metaDescription ? { description: doc.metaDescription } : {}),
    ...(doc.publishedAt ? { datePublished: doc.publishedAt } : {}),
    ...(doc.ogImageUrl ? { image: [doc.ogImageUrl] } : {}),
    mainEntityOfPage: url,
    publisher: { "@type": "Organization", name: "Renvani" }
  };
  const faq = (doc.faq ?? []).filter((f) => f?.question && f?.answer);
  if (faq.length === 0) return [article];
  return [
    article,
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } }))
    }
  ];
}

/** Safe for a <script type="application/ld+json"> body. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
