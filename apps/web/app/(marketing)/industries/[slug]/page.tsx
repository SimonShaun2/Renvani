import { serializeJsonLd, withMarketingSeo } from "@/src/lib/seo/marketing-metadata";
import { publicSiteUrl } from "@/src/lib/seo/public-site-origin";
import { breadcrumbStructuredData, industrySearchCopy } from "@/src/lib/seo/search-foundation";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { IndustryFrames } from "@/src/components/marketing/site/IndustryPage";
import { INDUSTRY_PAGE_BY_SLUG, INDUSTRY_PAGES } from "@/src/components/marketing/site/industry-registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return INDUSTRY_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = INDUSTRY_PAGE_BY_SLUG[slug];
  return page ? withMarketingSeo(page.href, industrySearchCopy(page)) : {};
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = INDUSTRY_PAGE_BY_SLUG[slug];
  if (!page) notFound();
  // Matches the existing visible Industries / [trade] breadcrumb; previews emit no structured data.
  const breadcrumbs = breadcrumbStructuredData(publicSiteUrl(), [
    { name: "Industries", path: "/industries" },
    { name: page.name, path: page.href }
  ]);
  return <>
    {breadcrumbs ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbs) }} /> : null}
    <IndustryFrames tree={page.slug} />
  </>;
}
