import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_ROUTE_PREFIXES, isPublicRoute } from "@/src/lib/route-access";
import { PRODUCTION_SITE_ORIGIN, publicSiteUrl } from "./public-site-origin";
import { MARKETING_SITEMAP_PATHS, ROBOTS_DISALLOW, buildFullSitemap, buildPublicRobots, buildSiteSitemapXml } from "./public-sitemap";
import { isCrawlable } from "./robots-match";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
const PROD = env({ VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production" });
const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const crawlable = isCrawlable;

describe("production robots.txt", () => {
  it("defaults to the canonical origin on a Vercel production deployment without PUBLIC_SITE_URL", () => {
    expect(publicSiteUrl(PROD)).toBe(PRODUCTION_SITE_ORIGIN);
    expect(publicSiteUrl(env({ ...PROD, PUBLIC_SITE_URL: "https://www.example.com/x" }))).toBe("https://www.example.com");
  });

  it("allows marketing, industry, blog and compare pages and advertises /sitemap.xml", () => {
    const robots = buildPublicRobots(PROD);
    expect(list(robots.sitemap as string | string[])).toContain("https://getrenvani.com/sitemap.xml");
    for (const path of ["/", "/pricing", "/product/growth", "/industries/hvac", "/growth-check", "/blog", "/blog/a-post", "/compare/x", "/demo"]) {
      expect(crawlable(robots, path), path).toBe(true);
    }
  });

  it("disallows /studio, /api, auth pages and every signed-in route from route-access", () => {
    const robots = buildPublicRobots(PROD);
    expect(ROBOTS_DISALLOW).toEqual(expect.arrayContaining(["/studio$", "/studio?", "/studio/", "/api$", "/api?", "/api/", "/login$", "/login?", "/login/"]));
    for (const path of ["/studio", "/studio/structure", "/api/revalidate", "/api/v1/x", "/login", "/signup", "/verify-email", "/onboarding/workspace"]) {
      expect(crawlable(robots, path), path).toBe(false);
    }
    expect(APP_ROUTE_PREFIXES).toEqual(expect.arrayContaining(["/dashboard", "/settings", "/mobile", "/studio"]));
    for (const prefix of APP_ROUTE_PREFIXES) {
      expect(crawlable(robots, prefix), prefix).toBe(false);
      expect(crawlable(robots, `${prefix}/x`), prefix).toBe(false);
    }
  });

  it.each(["preview", "development"])("stays noindex (Disallow: /) on %s even with PUBLIC_SITE_URL", (target) => {
    for (const e of [env({ VERCEL_ENV: target }), env({ VERCEL_ENV: target, PUBLIC_SITE_URL: "https://getrenvani.com" }), env({ ...PROD, VERCEL_TARGET_ENV: target })]) {
      expect(buildPublicRobots(e)).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
    }
  });
});

describe("/sitemap.xml", () => {
  const slugs = async () => [
    { _type: "post" as const, slug: "booking-tips", _updatedAt: "2026-11-02T00:00:00Z" },
    { _type: "comparisonPage" as const, slug: "switching-guide" }
  ];

  it("lists marketing, industry, /blog, post and compare URLs in production", async () => {
    const xml = (await buildSiteSitemapXml(PROD, slugs))!;
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><urlset')).toBe(true);
    for (const { path } of MARKETING_SITEMAP_PATHS) expect(xml).toContain(`<loc>https://getrenvani.com${path === "/" ? "" : path}</loc>`);
    expect(xml).toContain("<loc>https://getrenvani.com/industries/hvac</loc>");
    expect(xml).toContain("<loc>https://getrenvani.com/blog</loc>");
    expect(xml).toContain("<loc>https://getrenvani.com/blog/booking-tips</loc><lastmod>2026-11-02T00:00:00.000Z</lastmod>");
    expect(xml).toContain("<loc>https://getrenvani.com/compare/switching-guide</loc>");
    expect(xml).not.toMatch(/\/dashboard|\/studio|\/api\//);
  });

  it("fails soft when the CMS throws: marketing pages and /blog still listed", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const xml = (await buildSiteSitemapXml(PROD, async () => { throw new Error("sanity down"); }))!;
    expect(xml).toContain("<loc>https://getrenvani.com/pricing</loc>");
    expect(xml).toContain("<loc>https://getrenvani.com/blog</loc>");
    expect(xml).not.toContain("/blog/");
    log.mockRestore();
  });

  it("is not served on previews", async () => {
    expect(await buildSiteSitemapXml(env({ VERCEL_ENV: "preview", PUBLIC_SITE_URL: "https://getrenvani.com" }), slugs)).toBeNull();
  });

  it("route returns 200 XML in production and 404 elsewhere", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_TARGET_ENV", "production");
    const { GET } = await import("@/app/sitemap.xml/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    expect(await res.text()).toContain("<loc>https://getrenvani.com/blog</loc>");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET()).status).toBe(404);
  });

  it("is public in route-access and middleware (no login redirect)", async () => {
    expect(isPublicRoute("/sitemap.xml")).toBe(true);
    expect(isPublicRoute("/robots.txt")).toBe(true);
    vi.resetModules();
    const { middleware } = await import("../../../middleware");
    for (const path of ["/sitemap.xml", "/robots.txt"]) {
      const res = await middleware(new NextRequest(`http://localhost:3000${path}`));
      expect(res.headers.get("location"), path).toBeNull();
    }
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("robots evaluator (Google longest-match)", () => {
  const r = (allow: string[], disallow: string[]) => ({ rules: [{ userAgent: "*", allow, disallow }] });
  it("longest match wins, Allow wins ties, supports * and $", () => {
    expect(isCrawlable(r(["/"], ["/"]), "/x")).toBe(true); // tie → allow
    expect(isCrawlable(r(["/"], ["/api/"]), "/api/x")).toBe(false);
    expect(isCrawlable(r(["/"], ["/growth$", "/growth/"]), "/growth-check")).toBe(true);
    expect(isCrawlable(r(["/"], ["/growth$", "/growth/"]), "/growth")).toBe(false);
    expect(isCrawlable(r(["/book/"], ["/", "/book/*/manage"]), "/book/acme/manage")).toBe(false);
    expect(isCrawlable(r(["/book/"], ["/"]), "/book/acme")).toBe(true);
    expect(isCrawlable(r([], ["/"]), "/sitemap.xml")).toBe(false);
    expect(isCrawlable(r([], []), "/anything")).toBe(true);
  });
});

describe("production robots never blocks a public URL", () => {
  const slugs = async () => [
    { _type: "post" as const, slug: "booking-tips" },
    { _type: "comparisonPage" as const, slug: "switching-guide" }
  ];
  const pathOf = (url: string) => new URL(url).pathname;

  it("allows every URL in the full sitemap plus sitemaps and legal/about pages", async () => {
    const robots = buildPublicRobots(PROD);
    const xml = (await buildSiteSitemapXml(PROD, slugs))!;
    const flat = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => pathOf(m[1]!));
    const full = (await buildFullSitemap(env({ ...PROD, PUBLIC_SITE_SLUGS: "summit" }), async () => ({
      bookingSlug: "summit", companyName: "Summit", offeredServices: [{ name: "AC Repair" }], serviceAreaZipCodes: ["78701"]
    }))).map((e) => pathOf(e.url));
    expect(flat.length).toBeGreaterThanOrEqual(MARKETING_SITEMAP_PATHS.length + 3);
    expect(full).toEqual(expect.arrayContaining(["/site/summit", "/book/summit", "/blog"]));
    const paths = [...new Set([...flat, ...full, "/sitemap.xml", "/sitemap-index.xml", "/sitemap/0.xml", "/robots.txt", "/privacy", "/terms", "/about"])];
    for (const path of paths) expect(isCrawlable(robots, path), path).toBe(true);
  });

  it("still blocks private surfaces", () => {
    const robots = buildPublicRobots(PROD);
    for (const path of ["/studio", "/studio/desk", "/api/x", "/api/revalidate", "/login", "/login/sso", "/signup", "/verify-email", "/no-access",
      "/onboarding", "/onboarding/workspace", "/dashboard", "/settings/team", "/mobile/jobs", "/booking-requests", "/pay/tok", "/approve/tok",
      "/portal", "/portal/agreements/tok", "/review/tok", "/vip/join/tok", "/book/summit/manage", "/book/summit/confirm"]) {
      expect(isCrawlable(robots, path), path).toBe(false);
    }
  });

  it("previews still disallow everything", () => {
    const robots = buildPublicRobots(env({ VERCEL_ENV: "preview", PUBLIC_SITE_URL: "https://getrenvani.com" }));
    for (const path of ["/", "/pricing", "/sitemap.xml", "/blog"]) expect(isCrawlable(robots, path), path).toBe(false);
  });
});
