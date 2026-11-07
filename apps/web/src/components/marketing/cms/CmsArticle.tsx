import Link from "next/link";
import { PortableText, type PortableTextComponents } from "@portabletext/react";

import { cmsJsonLd, cmsPath, serializeJsonLd } from "@/src/lib/seo/cms-seo";
import type { CmsDoc } from "@/src/sanity/fetch";
import type { CmsType } from "@/src/sanity/env";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** Inline body images render only with alt text (alt is required in the schema). */
const components: PortableTextComponents = {
  types: {
    inlineImage: ({ value }: { value: { url?: string | null; alt?: string | null } }) =>
      value?.url && value.alt ? (
        <figure className="my-8">
          <img src={value.url} alt={value.alt} loading="lazy" className="w-full rounded-[12px]" />
        </figure>
      ) : null
  }
};

const isSitePath = (href?: string | null): href is string => !!href && /^\/[a-z0-9\-/]*$/.test(href);

/** CMS article (blog post or comparison). No Figma frame; built from marketing tokens. */
export function CmsArticle({ type, doc }: { type: CmsType; doc: CmsDoc }) {
  const faq = (doc.faq ?? []).filter((f) => f?.question && f?.answer);
  const related = (doc.relatedPosts ?? []).filter((p) => p?.slug && p?.title);
  const lead = doc.excerpt || doc.metaDescription;
  const image = doc.featuredImage?.url && doc.featuredImage.alt ? doc.featuredImage : null;
  return (
    <article className="mx-auto max-w-[760px] px-5 py-16 md:px-8 lg:py-24">
      {cmsJsonLd(type, doc).map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }} />
      ))}
      <p className="text-[12px] font-medium uppercase" style={{ color: "var(--color-mkt-ink2)" }} data-article-meta>
        {doc.author ? <span>{doc.author}</span> : null}
        {doc.author && doc.publishedAt ? " · " : null}
        {doc.publishedAt ? <time dateTime={doc.publishedAt}>{formatDate(doc.publishedAt)}</time> : null}
        {doc.updatedAt ? <> · Updated <time dateTime={doc.updatedAt}>{formatDate(doc.updatedAt)}</time></> : null}
      </p>
      <h1 className="mt-3 text-[36px] font-semibold leading-[1.15] md:text-[52px]">{doc.title}</h1>
      {lead ? <p className="mt-5 text-[18px] leading-[1.5] md:text-[20px]" style={{ color: "var(--color-mkt-ink2)" }}>{lead}</p> : null}
      {image ? (
        <figure className="mt-10">
          <img src={image.url!} alt={image.alt!} className="w-full rounded-[16px]" data-featured-image />
        </figure>
      ) : null}
      <div className="mt-10 space-y-5 text-[17px] leading-[1.65] [&_a]:underline [&_h2]:mt-10 [&_h2]:text-[28px] [&_h2]:font-semibold [&_h3]:mt-8 [&_h3]:text-[22px] [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
        {doc.body?.length ? <PortableText value={doc.body} components={components} /> : null}
      </div>
      {doc.cta?.label && isSitePath(doc.cta.href) ? (
        <p className="mt-12">
          <Link href={doc.cta.href} className="inline-flex rounded-full px-6 py-3 text-[16px] font-semibold" style={{ background: "var(--color-mkt-amber)", color: "var(--color-mkt-ink)" }} data-cms-cta>
            {doc.cta.label}
          </Link>
        </p>
      ) : null}
      {faq.length > 0 ? (
        <section aria-labelledby="cms-faq" className="mt-14">
          <h2 id="cms-faq" className="text-[28px] font-semibold">Questions</h2>
          <dl className="mt-6 space-y-6">
            {faq.map((f) => (
              <div key={f.question}>
                <dt className="text-[18px] font-semibold">{f.question}</dt>
                <dd className="mt-2 text-[16px] leading-[1.6]" style={{ color: "var(--color-mkt-ink2)" }}>{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {related.length > 0 ? (
        <nav aria-labelledby="cms-related" className="mt-14">
          <h2 id="cms-related" className="text-[22px] font-semibold">Related reading</h2>
          <ul className="mt-4 space-y-3">
            {related.map((p) => (
              <li key={p.slug}><Link href={cmsPath("post", p.slug)} className="text-[17px] underline">{p.title}</Link></li>
            ))}
          </ul>
        </nav>
      ) : null}
    </article>
  );
}
