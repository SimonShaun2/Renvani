import { PLAYBOOK_PATHS } from "@/src/lib/resources/playbook";
import { publicSiteUrl } from "./public-site-origin";
import type { MetadataRoute } from "next";

import type { PublicBookingSettingsRecord } from "@/src/hooks/booking.hooks";
import { INDUSTRY_PAGES } from "@/src/components/marketing/site/industry-registry";
import { listServiceAreaPages, serviceAreaPath } from "@/src/components/growth/service-pages/service-area-pages";
import { fetchPublicBookingSettingsBySlug } from "@/src/lib/public-booking-server";
import { APP_ROUTE_PREFIXES, AUTH_ROUTES, NO_ROLE_SETUP_ROUTES } from "@/src/lib/route-access";
import { CMS_TYPES } from "@/src/sanity/env";
import { fetchCmsSlugs, type CmsSlug } from "@/src/sanity/fetch";

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

/**
 * Production robots is allow-by-default (`Allow: /`) so every public page, including ones added later (marketing,
 * industries, blog, compare, legal, sitemaps), is crawlable without a registry edit. Private surfaces are blocked
 * explicitly below; the longest matching rule wins, so these disallows beat `Allow: /`.
 */
export const ROBOTS_ALLOW = [
  { key: "site", prefix: "/" },
  { key: "sitemap", prefix: "/sitemap.xml" },
  { key: "sitemap-index", prefix: "/sitemap-index.xml" },
  { key: "sitemap-chunks", prefix: "/sitemap/" }
] as const;

/**
 * Exact path, any query on it, and everything below it, without catching siblings (/growth must not block
 * /growth-check). `$` anchors the end of the full URL including the query, so `/x?` is needed for `/x?a=b`.
 */
const pathAndBelow = (prefix: string) => {
  const path = prefix.replace(/\/+$/, "");
  return [`${path}$`, `${path}?`, `${path}/`];
};

/** Reserved private aliases with no routes today; kept out of the index if they are ever added. */
const RESERVED_PRIVATE_PREFIXES = ["/app", "/auth", "/sign-in", "/sign-up"] as const;

/** Signed-in pages that exist under app/(app) but are not in any role list (kept out of the index regardless). */
const EXTRA_PRIVATE_PREFIXES = ["/booking-requests"] as const;

/** Token-scoped customer pages (payment links, approvals, portal, reviews, VIP invites): reachable, never indexed. */
const TOKEN_PREFIXES = ["/pay/", "/approve/", "/portal", "/review/", "/vip/"] as const;

/**
 * Explicit disallows: CMS Studio, every API route, auth pages, onboarding, every signed-in app route from route-access,
 * token-scoped customer pages and transactional booking steps. Normalize trailing slashes before generating the
 * same exact/query/directory boundaries for every prefix; dedupe overlaps between the route registries.
 */
export const ROBOTS_DISALLOW = [...new Set([
  "/studio",
  "/api",
  "/onboarding",
  ...AUTH_ROUTES,
  ...NO_ROLE_SETUP_ROUTES,
  ...APP_ROUTE_PREFIXES,
  ...EXTRA_PRIVATE_PREFIXES,
  ...RESERVED_PRIVATE_PREFIXES,
  ...TOKEN_PREFIXES,
  "/book/*/manage",
  "/book/*/confirm",
  "/book/*/confirmed",
  "/book/*/commit"
].flatMap(pathAndBelow))];

/** The flat sitemap crawlers and robots.txt point at (marketing, industries, blog, compare). */
export const SITEMAP_PATH = "/sitemap.xml";

export { publicSiteUrl } from "./public-site-origin";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function optInSlugs(env: NodeJS.ProcessEnv = process.env): string[] {
  const slugs = (env.PUBLIC_SITE_SLUGS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => SLUG_PATTERN.test(s));
  return [...new Set(slugs)].slice(0, 500);
}

export class SitemapPublishCheckError extends Error {
  constructor(readonly slugs: string[]) {
    super(`Sitemap publish check failed for ${slugs.length} shop(s): ${slugs.join(", ")}`);
    this.name = "SitemapPublishCheckError";
  }
}

type Fetcher = (slug: string) => Promise<unknown | null>;
type PublishedShopSettings = Pick<PublicBookingSettingsRecord, "bookingSlug" | "companyName" | "offeredServices" | "serviceAreaZipCodes">;

function isPublishedBookingSettings(value: unknown, slug: string): value is PublishedShopSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return settings.bookingSlug === slug &&
    typeof settings.companyName === "string" && settings.companyName.trim().length > 0 &&
    Array.isArray(settings.offeredServices) &&
    settings.offeredServices.every((service: unknown) => typeof service === "object" && service !== null && !Array.isArray(service)) &&
    (settings.serviceAreaZipCodes === undefined ||
      (Array.isArray(settings.serviceAreaZipCodes) && settings.serviceAreaZipCodes.every((zip: unknown) => typeof zip === "string")));
}

/** Per-shop cap on service x area URLs (offered services x ZIPs can grow fast). */
export const MAX_SERVICE_AREA_URLS_PER_SHOP = 500;

type ServiceAreaSource = Pick<PublicBookingSettingsRecord, "offeredServices" | "serviceAreaZipCodes">;

/**
 * Service x area pages for a published shop, from the same public settings the page route renders
 * (resolveServiceAreaPage 404s anything not listed here). Deduped by path; empty service slugs skipped.
 */
export function serviceAreaSitemapPaths(slug: string, settings: unknown): string[] {
  if (!settings || typeof settings !== "object") return [];
  const source = settings as Partial<ServiceAreaSource>;
  if (!Array.isArray(source.offeredServices)) return [];
  const pages = listServiceAreaPages({
    offeredServices: source.offeredServices,
    serviceAreaZipCodes: Array.isArray(source.serviceAreaZipCodes) ? source.serviceAreaZipCodes : []
  });
  const paths = new Set<string>();
  for (const page of pages) {
    if (!page.serviceSlug) continue;
    paths.add(serviceAreaPath(encodeURIComponent(slug), page));
    if (paths.size >= MAX_SERVICE_AREA_URLS_PER_SHOP) break;
  }
  return [...paths];
}

export async function buildPublicSitemap(
  env: NodeJS.ProcessEnv = process.env,
  fetchSettings: Fetcher = fetchPublicBookingSettingsBySlug
): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl(env);
  if (!base) return [];
  const failures: { slug: string; error: unknown }[] = [];
  const published = await Promise.all(
    optInSlugs(env).map(async (slug) => {
      try {
        // null = genuinely unpublished (API 404); a throw = outage/bad response, never treated as unpublished.
        const settings = await fetchSettings(slug);
        if (settings === null) return null;
        if (!isPublishedBookingSettings(settings, slug)) {
          throw new Error("Invalid public booking settings response");
        }
        return { slug, settings };
      } catch (error) {
        failures.push({ slug, error });
        return null;
      }
    })
  );
  if (failures.length > 0) {
    for (const { slug, error } of failures) {
      console.error("[sitemap] publish check failed", { slug, error: error instanceof Error ? error.message : String(error) });
    }
    // Fail this render visibly: Next keeps serving the last good sitemap instead of caching shops as unpublished.
    throw new SitemapPublishCheckError(failures.map((f) => f.slug));
  }
  return published
    .filter((shop): shop is { slug: string; settings: PublishedShopSettings } => shop !== null)
    .flatMap(({ slug, settings }) => [
      ...SHOP_PAGE_TYPES.map((type) => ({
        url: `${base}${type.path(encodeURIComponent(slug))}`,
        changeFrequency: "weekly" as const,
        priority: type.priority
      })),
      ...serviceAreaSitemapPaths(slug, settings).map((path) => ({
        url: `${base}${path}`,
        changeFrequency: "weekly" as const,
        priority: 0.6
      }))
    ]);
}

/** Marketing website pages (Figma 171:2) listed in the sitemap. Add a page here when its route ships. */
export const MARKETING_SITEMAP_PATHS = [
  { path: "/", priority: 1 },
  { path: "/product", priority: 0.9 },
  { path: "/how-it-works", priority: 0.9 },
  ...["growth", "revenue", "operations", "retention", "command-center", "online-booking", "estimates-approvals", "scheduling-dispatch", "technician-app", "invoices-payments", "service-agreements", "ai-revenue-intelligence", "customers-properties-assets", "onboarding-data-import", "inquiry-response-follow-up", "jobs-work-orders", "time-tracking-job-photos", "reminders-win-backs", "reporting-job-sources", "websites", "price-book-service-catalog", "customer-portal"].map((slug) => ({ path: `/product/${slug}`, priority: 0.8 })),
  { path: "/tour", priority: 0.8 },
  ...["approve-the-work", "plan-the-day", "complete-the-visit", "get-paid", "bring-them-back"].map((slug) => ({ path: `/tour/${slug}`, priority: 0.7 })),
  { path: "/pricing", priority: 0.8 },
  { path: "/industries", priority: 0.8 },
  { path: "/demo", priority: 0.8 },
  { path: "/growth-check", priority: 0.7 },
  ...PLAYBOOK_PATHS.map(path => ({ path, priority: 0.7 })),
  ...INDUSTRY_PAGES.map((industry) => ({ path: industry.href, priority: 0.7 }))
] as const;

export function buildMarketingSitemap(env: NodeJS.ProcessEnv = process.env): MetadataRoute.Sitemap {
  const base = publicSiteUrl(env);
  if (!base) return [];
  return MARKETING_SITEMAP_PATHS.map((p) => ({ url: `${base}${p.path === "/" ? "" : p.path}`, changeFrequency: "weekly" as const, priority: p.priority }));
}

/** /blog plus published Sanity posts (/blog/:slug) and comparison pages (/compare/:slug). CMS errors fail soft to /blog only. */
export async function buildCmsSitemap(
  env: NodeJS.ProcessEnv = process.env,
  fetchSlugs: () => Promise<CmsSlug[]> = fetchCmsSlugs
): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl(env);
  if (!base) return [];
  let docs: CmsSlug[] = [];
  try {
    const result = await fetchSlugs();
    docs = Array.isArray(result) ? result.slice(0, MAX_CMS_SITEMAP_URLS - 1) : [];
  } catch (error) {
    console.error("[sitemap] CMS slugs unavailable", error instanceof Error ? error.message : String(error));
  }
  return [
    { url: `${base}/blog`, changeFrequency: "weekly" as const, priority: 0.7 },
    ...docs
      .filter((d) => typeof d?.slug === "string" && d.slug && Object.prototype.hasOwnProperty.call(CMS_TYPES, d._type))
      .map((d) => ({
        url: `${base}${CMS_TYPES[d._type]}/${encodeURIComponent(d.slug)}`,
        ...(d._updatedAt ? { lastModified: d._updatedAt } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.6
      }))
  ];
}

/** /sitemap.xml: marketing + industry pages, /blog, posts and comparison pages. Never throws for CMS outages. */
export async function buildSiteSitemapXml(
  env: NodeJS.ProcessEnv = process.env,
  fetchSlugs: () => Promise<CmsSlug[]> = fetchCmsSlugs
): Promise<string | null> {
  if (!publicSiteUrl(env)) return null;
  const entries = [...buildMarketingSitemap(env), ...(await buildCmsSitemap(env, fetchSlugs))];
  const urls = entries
    .map((e) => {
      const lastmod = e.lastModified ? `<lastmod>${xmlEscape(new Date(e.lastModified).toISOString())}</lastmod>` : "";
      const freq = e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : "";
      const priority = typeof e.priority === "number" ? `<priority>${e.priority}</priority>` : "";
      return `<url><loc>${xmlEscape(e.url)}</loc>${lastmod}${freq}${priority}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function buildPublicRobots(env: NodeJS.ProcessEnv = process.env): MetadataRoute.Robots {
  const base = publicSiteUrl(env);
  // Anything but an explicitly identified production deployment (see isProductionDeployment): block everything and
  // advertise no sitemap, even when PUBLIC_SITE_URL names production.
  if (!base) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: ROBOTS_ALLOW.map((a) => a.prefix), disallow: [...ROBOTS_DISALLOW] }],
    sitemap: [`${base}${SITEMAP_PATH}`, `${base}${SITEMAP_INDEX_PATH}`],
    host: base
  };
}

/** Protocol limit per sitemap file (sitemaps.org): 50,000 URLs. */
export const SITEMAP_URL_LIMIT = 50_000;
/** Opt-in shops are capped at 500 (optInSlugs), each with at most SHOP_PAGE_TYPES + MAX_SERVICE_AREA_URLS_PER_SHOP URLs. */
/** Headroom reserved for CMS posts and comparison pages (plus /blog). */
export const MAX_CMS_SITEMAP_URLS = 2_000;
export const MAX_SITEMAP_URLS =
  MARKETING_SITEMAP_PATHS.length + MAX_CMS_SITEMAP_URLS + 500 * (SHOP_PAGE_TYPES.length + MAX_SERVICE_AREA_URLS_PER_SHOP);
/** Fixed sitemap count covering the worst case, so ids are stable for generateSitemaps and the index. */
export const SITEMAP_COUNT = Math.ceil(MAX_SITEMAP_URLS / SITEMAP_URL_LIMIT);
export const SITEMAP_INDEX_PATH = "/sitemap-index.xml";

export function sitemapIds(): { id: number }[] {
  return Array.from({ length: SITEMAP_COUNT }, (_, id) => ({ id }));
}

/** Deterministic split: chunk `id` holds entries [id*limit, (id+1)*limit). Empty chunks are valid empty urlsets. */
export function sitemapChunk(all: MetadataRoute.Sitemap, id: number, limit = SITEMAP_URL_LIMIT): MetadataRoute.Sitemap {
  if (!Number.isInteger(id) || id < 0) return [];
  return all.slice(id * limit, (id + 1) * limit);
}

export async function buildFullSitemap(
  env: NodeJS.ProcessEnv = process.env,
  fetchSettings: Fetcher = fetchPublicBookingSettingsBySlug
): Promise<MetadataRoute.Sitemap> {
  return [...buildMarketingSitemap(env), ...(await buildCmsSitemap(env)), ...(await buildPublicSitemap(env, fetchSettings))];
}

const xmlEscape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Sitemap index (sitemaps.org) listing every split sitemap served by app/sitemap.ts at /sitemap/{id}.xml. */
export function buildSitemapIndexXml(env: NodeJS.ProcessEnv = process.env): string | null {
  const base = publicSiteUrl(env);
  if (!base) return null;
  const items = sitemapIds()
    .map(({ id }) => `<sitemap><loc>${xmlEscape(`${base}/sitemap/${id}.xml`)}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}