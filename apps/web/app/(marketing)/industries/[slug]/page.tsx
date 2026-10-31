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
  return page ? { title: page.title, description: page.description } : {};
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = INDUSTRY_PAGE_BY_SLUG[slug];
  if (!page) notFound();
  return <IndustryFrames tree={page.slug} />;
}
