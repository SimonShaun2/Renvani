import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  MAX_SERVICE_AREA_URLS_PER_SHOP,
  ROBOTS_ALLOW,
  SitemapPublishCheckError,
  MARKETING_SITEMAP_PATHS,
  SITEMAP_COUNT,
  SITEMAP_URL_LIMIT,
  buildFullSitemap,
  buildSitemapIndexXml,
  sitemapChunk,
  sitemapIds,
  serviceAreaSitemapPaths, buildPublicRobots, buildPublicSitemap, buildSiteSitemapXml, optInSlugs, publicSiteUrl } from "./public-sitemap";
import { isCrawlable } from "./robots-match";
import { isProductionDeployment } from "./public-site-origin";
import { APP_ROUTE_PREFIXES, AUTH_ROUTES } from "@/src/lib/route-access";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
const publishedBooking = (slug: string, offeredServices: Array<Record<string, unknown>> = [], serviceAreaZipCodes: string[] = []) => ({
  bookingSlug: slug,
  companyName: "Summit",
  offeredServices,
  serviceAreaZipCodes
});

describe("public sitemap", () => {
  it("lists only opted-in slugs that are published", async () => {
    const fetcher = vi.fn(async (slug: string) => (slug === "summit" ? publishedBooking(slug) : null));
    const map = await buildPublicSitemap(env({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://shops.example/x", PUBLIC_SITE_SLUGS: "summit, draft-shop" }), fetcher);
    expect(map.map((e) => e.url)).toEqual([
      "https://shops.example/site/summit",
      "https://shops.example/site/summit/inquire",
      "https://shops.example/book/summit"
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("lists no shops without opt-in or base URL, and never enumerates", async () => {
    const fetcher = vi.fn(async () => ({}));
    expect(await buildPublicSitemap(env({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://s.example" }), fetcher)).toEqual([]);
    expect(await buildPublicSitemap(env({ PUBLIC_SITE_SLUGS: "summit" }), fetcher)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("drops unsafe slugs and dedupes", () => {
    expect(optInSlugs(env({ PUBLIC_SITE_SLUGS: "a-1,A-1,../admin,,b%2f" }))).toEqual(["a-1"]);
  });

  it("logs and fails the render on publish-check errors instead of treating shops as unpublished", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetcher = vi.fn(async (slug: string) => {
      if (slug === "down") throw new Error("503");
      return slug === "ok" ? publishedBooking(slug) : null;
    });
    await expect(
      buildPublicSitemap(env({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://s.example", PUBLIC_SITE_SLUGS: "ok,down,draft" }), fetcher)
    ).rejects.toBeInstanceOf(SitemapPublishCheckError);
    expect(log).toHaveBeenCalledWith("[sitemap] publish check failed", { slug: "down", error: "503" });
    log.mockRestore();
  });

  it("rejects non-http base URLs", () => {
    expect(publicSiteUrl(env({ PUBLIC_SITE_URL: "javascript:alert(1)" }))).toBeNull();
  });

  it("fails visibly for malformed or cross-shop publish responses", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const fetcher = vi.fn(async (slug: string) => {
        if (slug === "missing") return undefined;
        if (slug === "malformed") return { bookingSlug: slug, companyName: "Summit" };
        return publishedBooking("another-shop");
      });
      await expect(buildPublicSitemap(
        env({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://s.example", PUBLIC_SITE_SLUGS: "missing,malformed,mismatch" }), fetcher
      )).rejects.toMatchObject({ slugs: expect.arrayContaining(["missing", "malformed", "mismatch"]) });
      expect(log).toHaveBeenCalledTimes(3);
    } finally {
      log.mockRestore();
    }
  });
});

describe("robots", () => {
  const ruleOf = (robots: ReturnType<typeof buildPublicRobots>) => (Array.isArray(robots.rules) ? robots.rules[0] : robots.rules);
  const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

  it("opens crawling only for an identified production deployment (VERCEL_ENV=production, target production or absent)", () => {
    for (const e of [
      env({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://s.example" }),
      env({ VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production", PUBLIC_SITE_URL: "https://s.example" })
    ]) {
      const robots = buildPublicRobots(e);
      const rule = ruleOf(robots);
      expect(list(rule?.allow)).toEqual(ROBOTS_ALLOW.map((a) => a.prefix));
      expect(list(rule?.allow)).toEqual(expect.arrayContaining(["/", "/sitemap.xml", "/sitemap-index.xml", "/sitemap/"]));
      expect(list(rule?.disallow)).not.toContain("/");
      expect(list(rule?.disallow)).toEqual(expect.arrayContaining(["/studio$", "/studio?", "/studio/", "/api$", "/api?", "/api/", "/book/*/manage$"]));
      for (const path of ["/site/summit", "/site/summit/ac-repair/78701", "/book/summit"]) expect(isCrawlable(robots, path), path).toBe(true);
      expect(isCrawlable(robots, "/book/summit/manage")).toBe(false);
      expect(robots.sitemap).toEqual(["https://s.example/sitemap.xml", "https://s.example/sitemap-index.xml"]);
    }
  });

  const CLOSED: [string, Record<string, string>][] = [
    ["both deployment vars missing", {}],
    ["VERCEL_ENV empty", { VERCEL_ENV: "" }],
    ["VERCEL_ENV unknown (staging)", { VERCEL_ENV: "staging" }],
    ["VERCEL_ENV=preview", { VERCEL_ENV: "preview" }],
    ["VERCEL_ENV=development", { VERCEL_ENV: "development" }],
    ["VERCEL_ENV=Production (wrong case)", { VERCEL_ENV: "Production" }],
    ["VERCEL_ENV=production, VERCEL_TARGET_ENV=preview", { VERCEL_ENV: "production", VERCEL_TARGET_ENV: "preview" }],
    ["VERCEL_ENV=production, VERCEL_TARGET_ENV=staging", { VERCEL_ENV: "production", VERCEL_TARGET_ENV: "staging" }],
    ["VERCEL_ENV=production, VERCEL_TARGET_ENV empty", { VERCEL_ENV: "production", VERCEL_TARGET_ENV: "" }],
    ["VERCEL_TARGET_ENV=production, VERCEL_ENV missing", { VERCEL_TARGET_ENV: "production" }],
    ["VERCEL_TARGET_ENV=production, VERCEL_ENV=preview", { VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "production" }]
  ];

  it.each(CLOSED)("fails closed (Disallow: /, no sitemaps, no origin) when %s, even with PUBLIC_SITE_URL=getrenvani.com", async (_, vars) => {
    const e = env({ ...vars, PUBLIC_SITE_URL: "https://getrenvani.com" });
    expect(isProductionDeployment(e)).toBe(false);
    expect(publicSiteUrl(e)).toBeNull();
    const robots = buildPublicRobots(e);
    expect(robots).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
    expect(robots.sitemap).toBeUndefined();
    expect(robots.host).toBeUndefined();
    expect(isCrawlable(robots, "/")).toBe(false);
    expect(buildSitemapIndexXml(e)).toBeNull();
    expect(await buildSiteSitemapXml(e, async () => [])).toBeNull();
  });

  it("blocks query-string variants of every private prefix while public siblings stay crawlable", () => {
    const robots = buildPublicRobots(env({ VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production" }));
    for (const path of ["/login?redirect=x", "/login?redirect=%2Fdashboard", "/dashboard?tab=summary", "/booking-requests?filter=new",
      "/signup?plan=x", "/verify-email?token=t", "/no-access?x=1", "/onboarding?step=2", "/onboarding/workspace?x=1", "/settings?tab=team",
      "/mobile?x=1", "/growth?x=1", "/app", "/app?x=1", "/app/x", "/auth", "/auth?x=1", "/auth/callback", "/sign-in", "/sign-in?x=1",
      "/sign-in/sso", "/sign-up", "/sign-up?x=1", "/sign-up/verify", "/studio?x=1", "/api/x?y=1"]) {
      expect(isCrawlable(robots, path), path).toBe(false);
    }
    for (const prefix of [...APP_ROUTE_PREFIXES, ...AUTH_ROUTES, "/booking-requests"]) {
      for (const path of [prefix, `${prefix}?q=1`, `${prefix}/x`]) expect(isCrawlable(robots, path), path).toBe(false);
    }
    for (const path of ["/growth-check", "/growth-check?ref=x", "/approve-guide", "/applications", "/products-guide", "/product?x=1", "/pricing?plan=pro",
      "/blog?page=2", "/industries/hvac?x=1", "/settings-help", "/authors", "/sign-installers"]) {
      expect(isCrawlable(robots, path), path).toBe(true);
    }
  });

  it("keeps every signed-in route segment (app/(app), (auth), (mobile)) disallowed", () => {
    const appDir = join(dirname(fileURLToPath(import.meta.url)), "../../../app");
    const segments = ["(app)", "(auth)", "(mobile)"].flatMap((group) =>
      readdirSync(join(appDir, group), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => `/${d.name}`)
    );
    expect(segments).toEqual(expect.arrayContaining(["/dashboard", "/command-center", "/settings", "/login"]));
    const robots = buildPublicRobots(env({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://s.example" }));
    for (const segment of segments) {
      expect(isCrawlable(robots, segment), segment).toBe(false);
      expect(isCrawlable(robots, `${segment}/x`), segment).toBe(false);
    }
  });
});

describe("service x area sitemap entries", () => {
  const settings = {
    bookingSlug: "summit",
    companyName: "Summit",
    offeredServices: [{ name: "AC Repair" }, { label: "Furnace Tune-Up" }, { name: "ac repair" }, { price: 5 }],
    serviceAreaZipCodes: ["78701", "78702", "78701", "bad"]
  };

  it("lists /site/:slug/:service/:area only for published opted-in shops, deduped, valid ZIPs only", async () => {
    const fetcher = vi.fn(async (slug: string) => (slug === "summit" ? settings : null));
    const map = await buildPublicSitemap(env({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://s.example", PUBLIC_SITE_SLUGS: "summit,draft" }), fetcher);
    const urls = map.map((e) => e.url);
    const serviceUrls = urls.filter((u) => u.split("/").length === 7);
    expect(serviceUrls.sort()).toEqual(
      [
        "https://s.example/site/summit/ac-repair/78701",
        "https://s.example/site/summit/ac-repair/78702",
        "https://s.example/site/summit/furnace-tune-up/78701",
        "https://s.example/site/summit/furnace-tune-up/78702"
      ].sort()
    );
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.some((u) => u.includes("/draft"))).toBe(false);
  });

  it("every listed path resolves on the page route (same source as resolveServiceAreaPage)", async () => {
    const { resolveServiceAreaPage } = await import("@/src/components/growth/service-pages/service-area-pages");
    for (const path of serviceAreaSitemapPaths("summit", settings)) {
      const [, , , service, area] = path.split("/");
      expect(resolveServiceAreaPage(settings, service!, area!)).not.toBeNull();
    }
  });

  it("emits nothing for settings without services and caps per shop", () => {
    expect(serviceAreaSitemapPaths("summit", { companyName: "x" })).toEqual([]);
    expect(serviceAreaSitemapPaths("summit", null)).toEqual([]);
    const many = {
      offeredServices: Array.from({ length: 30 }, (_, i) => ({ name: `Service ${i}` })),
      serviceAreaZipCodes: Array.from({ length: 300 }, (_, i) => String(10000 + i))
    };
    expect(serviceAreaSitemapPaths("summit", many)).toHaveLength(MAX_SERVICE_AREA_URLS_PER_SHOP);
  });

  it("robots allows the service-area route", () => {
    expect(isCrawlable(buildPublicRobots(env({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://s.example" })), "/site/summit/ac-repair/78701")).toBe(true);
  });
});

describe("split sitemaps at 500-shop scale", () => {
  it("keeps every sitemap at most 50,000 URLs, loses or duplicates nothing, and the index covers all", async () => {
    const slugs = Array.from({ length: 500 }, (_, i) => `shop-${i}`);
    const zips = Array.from({ length: 125 }, (_, i) => String(10000 + i));
    const settings = {
      offeredServices: ["AC Repair", "Furnace Install", "Drain Cleaning", "Panel Upgrade"].map((name) => ({ name })),
      serviceAreaZipCodes: zips
    };
    const e = env({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://s.example", PUBLIC_SITE_SLUGS: slugs.join(",") });
    const all = await buildFullSitemap(e, async (slug) => ({ ...settings, bookingSlug: slug, companyName: "Summit" }));
    const perShop = serviceAreaSitemapPaths("shop-0", settings).length;
    expect(perShop).toBe(Math.min(4 * 125, MAX_SERVICE_AREA_URLS_PER_SHOP));
    expect(all.length).toBeGreaterThan(SITEMAP_URL_LIMIT);
    expect(all.length).toBe(MARKETING_SITEMAP_PATHS.length + 1 /* /blog */ + 500 * (3 + perShop));

    const chunks = sitemapIds().map(({ id }) => sitemapChunk(all, id));
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(SITEMAP_URL_LIMIT);
    const urls = chunks.flat().map((x) => x.url);
    expect(urls).toHaveLength(all.length);
    expect(new Set(urls).size).toBe(urls.length);
    expect(new Set(urls)).toEqual(new Set(all.map((x) => x.url)));
    expect(sitemapChunk(all, SITEMAP_COUNT)).toEqual([]);

    const xml = buildSitemapIndexXml(e)!;
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(sitemapIds().map(({ id }) => `https://s.example/sitemap/${id}.xml`));
    expect(locs.length).toBe(SITEMAP_COUNT);
  });

  it("serves no index without a base URL", () => {
    expect(buildSitemapIndexXml(env({}))).toBeNull();
  });
});
