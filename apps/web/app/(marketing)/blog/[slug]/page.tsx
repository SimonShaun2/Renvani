import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CmsArticle } from "@/src/components/marketing/cms/CmsArticle";
import { cmsMetadata } from "@/src/lib/seo/cms-seo";
import { fetchCmsDoc } from "@/src/sanity/fetch";

export const revalidate = 60;
export const dynamicParams = true;

/** Nothing is prerendered at build (works with no CMS env); pages render on first request and are tag-revalidated. */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await fetchCmsDoc("post", slug);
  return doc ? cmsMetadata("post", doc) : { title: "Not found · Renvani", robots: { index: false } };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const doc = await fetchCmsDoc("post", slug);
  if (!doc) notFound();
  return <CmsArticle type="post" doc={doc} />;
}
