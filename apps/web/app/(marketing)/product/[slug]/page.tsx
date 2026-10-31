import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FlagshipPage } from "@/src/components/marketing/site/FlagshipPage";
import { PRODUCT_PAGE_BY_SLUG, PRODUCT_PAGES } from "@/src/components/marketing/site/flagship-registry";

export const dynamicParams = false;

export function generateStaticParams() {
  return PRODUCT_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = PRODUCT_PAGE_BY_SLUG[slug];
  return page ? { title: `${page.name} · Renvani`, description: page.body } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PRODUCT_PAGE_BY_SLUG[slug];
  if (!page) notFound();
  return <FlagshipPage page={page} />;
}
