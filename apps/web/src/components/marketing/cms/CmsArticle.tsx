import { PortableText } from "@portabletext/react";

import { cmsJsonLd, serializeJsonLd } from "@/src/lib/seo/cms-seo";
import type { CmsDoc } from "@/src/sanity/fetch";
import type { CmsType } from "@/src/sanity/env";

/** CMS article (blog post or comparison). No Figma frame; built from marketing tokens. */
export function CmsArticle({ type, doc }: { type: CmsType; doc: CmsDoc }) {
  const faq = (doc.faq ?? []).filter((f) => f?.question && f?.answer);
  return (
    <article className="mx-auto max-w-[760px] px-5 py-16 md:px-8 lg:py-24">
      {cmsJsonLd(type, doc).map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }} />
      ))}
      {doc.publishedAt ? (
        <p className="text-[12px] font-medium uppercase" style={{ color: "var(--color-mkt-ink2)" }}>
          <time dateTime={doc.publishedAt}>{new Date(doc.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}</time>
        </p>
      ) : null}
      <h1 className="mt-3 text-[36px] font-semibold leading-[1.15] md:text-[52px]">{doc.title}</h1>
      {doc.metaDescription ? <p className="mt-5 text-[18px] leading-[1.5] md:text-[20px]" style={{ color: "var(--color-mkt-ink2)" }}>{doc.metaDescription}</p> : null}
      <div className="mt-10 space-y-5 text-[17px] leading-[1.65] [&_a]:underline [&_h2]:mt-10 [&_h2]:text-[28px] [&_h2]:font-semibold [&_h3]:mt-8 [&_h3]:text-[22px] [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
        {doc.body?.length ? <PortableText value={doc.body} /> : null}
      </div>
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
    </article>
  );
}
