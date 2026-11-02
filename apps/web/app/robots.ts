import type { MetadataRoute } from "next";

import { buildPublicRobots } from "@/src/lib/seo/public-sitemap";

export default function robots(): MetadataRoute.Robots {
  return buildPublicRobots();
}
