import type { Metadata } from "next";
import Link from "next/link";

import { canonicalUrl, cmsPath } from "@/src/lib/seo/cms-seo";
import { fetchCmsList } from "@/src/sanity/fetch";

export const revalidate = 60;

export function generateMetadata(): Metadata {
  return {
    title: "Blog · Renvani",
    description: "Guides for running and growing a home-services business: booking, scheduling, invoicing and keeping customers coming back.",
    alternates: { canonical: canonicalUrl("/blog") }
  };
}

export default async function BlogIndex() {
  const posts = await fetchCmsList("post");
  return (
    <section className="mx-auto max-w-[960px] px-5 py-16 md:px-8 lg:py-24">
      <h1 className="text-[36px] font-semibold leading-[1.15] md:text-[52px]">Blog</h1>
      <p className="mt-4 text-[18px]" style={{ color: "var(--color-mkt-ink2)" }}>Guides for home-service shops.</p>
      {posts.length === 0 ? (
        <p className="mt-12 text-[16px]" data-empty-state style={{ color: "var(--color-mkt-ink2)" }}>No posts yet. Check back soon.</p>
      ) : (
        <ul className="mt-12 space-y-8">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={cmsPath("post", p.slug)} className="text-[24px] font-semibold hover:underline">{p.title}</Link>
              {p.metaDescription ? <p className="mt-2 text-[16px]" style={{ color: "var(--color-mkt-ink2)" }}>{p.metaDescription}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
