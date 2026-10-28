import type { MetadataRoute } from "next";

import { fetchPublicBookingSettingsBySlug } from "@/src/lib/public-booking-server";

/**
 * Public sitemap sources (registry). A shop is listed only if it (1) opted in to public pages and (2) is published.
 * (2) = GET /api/v1/public/booking/:slug returns 200 (API 404s unless booking_settings.is_enabled).
 * (1) has no API flag yet, so opt-in is the server-only allowlist PUBLIC_SITE_SLUGS (comma-separated). Unset = no shops.
 */
export const SHOP_PAGE_TYPES = [
  { key: "site", path: (slug: string) => `/site/${slug}`, priority: 0.8 },
  { key: "inquire", path: (slug: string) => `/site/${slug}/inquire`, priority: 0.5 },
  { key: "book", path: (slug: string) => `/book/${slug}`, priority: 0.7 }
] as const;

/** Paths never meant for crawlers: tokenized, authenticated or transactional. */
export const ROBOTS_DISALLOW = [
  "/api/",
  "/book/*/manage",
  "/book/*/confirm",
  "/book/*/confirmed",
  "/book/*/commit",
  "/pay/",
  "/portal",
  "/review/",
  "/vip/",
  "/approve/"
] as const;

export function publicSiteUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function optInSlugs(env: NodeJS.ProcessEnv = process.env): string[] {
  const slugs = (env.PUBLIC_SITE_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => SLUG_PATTERN.test(s));
  return [...new Set(slugs)].slice(0, 500);
}

type Fetcher = (slug: string) => Promise<unknown | null>;

export async function buildPublicSitemap(
  env: NodeJS.ProcessEnv = process.env,
  fetchSettings: Fetcher = fetchPublicBookingSettingsBySlug
): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl(env);
  if (!base) return [];
  const published = await Promise.all(
    optInSlugs(env).map(async (slug) => ((await fetchSettings(slug).catch(() => null)) ? slug : null))
  );
  return published
    .filter((slug): slug is string => slug !== null)
    .flatMap((slug) =>
      SHOP_PAGE_TYPES.map((type) => ({
        url: `${base}${type.path(encodeURIComponent(slug))}`,
        changeFrequency: "weekly" as const,
        priority: type.priority
      }))
    );
}

export function buildPublicRobots(env: NodeJS.ProcessEnv = process.env): MetadataRoute.Robots {
  const base = publicSiteUrl(env);
  return {
    rules: [{ userAgent: "*", allow: ["/site/", "/book/"], disallow: [...ROBOTS_DISALLOW] }],
    ...(base ? { sitemap: `${base}/sitemap.xml`, host: base } : {})
  };
}
