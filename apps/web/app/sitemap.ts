import type { MetadataRoute } from "next";

import { buildMarketingSitemap, buildPublicSitemap } from "@/src/lib/seo/public-sitemap";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [...buildMarketingSitemap(), ...(await buildPublicSitemap())];
}
