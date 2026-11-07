import type { Metadata } from "next";
import Link from "next/link";

import { cmsPath } from "@/src/lib/seo/cms-seo";
import { withMarketingSeo } from "@/src/lib/seo/marketing-metadata";
import { fetchCmsList } from "@/src/sanity/fetch";

export const revalidate = 60;

export function generateMetadata(): Metadata {
  return withMarketingSeo("/blog", {
    title: "Articles & Guides | The Renvani Playbook",
    description: "Guides for running and growing a home-services business: booking, scheduling, invoicing and keeping customers coming back."
  });
}

export default async function BlogIndex() {
  const posts = await fetchCmsList("post");
  return (
    <section className="mx-auto max-w-[960px] px-5 py-16 md:px-8 lg:py-24">
      <Link href="/resources" className="mb-6 inline-flex min-h-[44px] items-center text-[14px] underline underline-offset-4">← The Renvani Playbook</Link>
      <h1 className="text-[36px] font-semibold leading-[1.15] md:text-[52px]">Articles &amp; guides</h1>
      <p className="mt-4 text-[18px]" style={{ color: "var(--color-mkt-ink2)" }}>Guides for home-service shops.</p>
      {posts.length === 0 ? (
        <p className="mt-12 text-[16px]" data-empty-state style={{ color: "var(--color-mkt-ink2)" }}>Articles will appear here when published. <Link href="/resources" className="underline underline-offset-4">Explore the ready-to-use templates in the Playbook.</Link></p>
      ) : (
        <ul className="mt-12 space-y-8">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={cmsPath("post", p.slug)} className="text-[24px] font-semibold hover:underline">{p.title}</Link>
              {p.excerpt || p.metaDescription ? <p className="mt-2 text-[16px]" style={{ color: "var(--color-mkt-ink2)" }}>{p.excerpt || p.metaDescription}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
