import type { MetadataRoute } from "next";

import { buildFullSitemap, sitemapChunk, sitemapIds } from "@/src/lib/seo/public-sitemap";

export const revalidate = 3600;

/** Split sitemaps at /sitemap/{id}.xml (each at most 50,000 URLs); the index is app/sitemap-index.xml. */
export async function generateSitemaps() {
  return sitemapIds();
}

export default async function sitemap({ id }: { id: number | string | Promise<number | string> }): Promise<MetadataRoute.Sitemap> {
  return sitemapChunk(await buildFullSitemap(), Number(await id));
}
