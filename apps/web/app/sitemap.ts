import type { MetadataRoute } from "next";

import { buildPublicSitemap } from "@/src/lib/seo/public-sitemap";

export const revalidate = 3600;

export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildPublicSitemap();
}
