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
  serviceAreaSitemapPaths, buildPublicRobots, buildPublicSitemap, optInSlugs, publicSiteUrl } from "./public-sitemap";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("public sitemap", () => {
  it("lists only opted-in slugs that are published", async () => {
    const fetcher = vi.fn(async (slug: string) => (slug === "summit" ? { companyName: "Summit" } : null));
    const map = await buildPublicSitemap(env({ PUBLIC_SITE_URL: "https://shops.example/x", PUBLIC_SITE_SLUGS: "summit, draft-shop" }), fetcher);
    expect(map.map((e) => e.url)).toEqual([
      "https://shops.example/site/summit",
      "https://shops.example/site/summit/inquire",
      "https://shops.example/book/summit"
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("lists no shops without opt-in or base URL, and never enumerates", async () => {
    const fetcher = vi.fn(async () => ({}));
    expect(await buildPublicSitemap(env({ PUBLIC_SITE_URL: "https://s.example" }), fetcher)).toEqual([]);
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
      return slug === "ok" ? {} : null;
    });
    await expect(
      buildPublicSitemap(env({ PUBLIC_SITE_URL: "https://s.example", PUBLIC_SITE_SLUGS: "ok,down,draft" }), fetcher)
    ).rejects.toBeInstanceOf(SitemapPublishCheckError);
    expect(log).toHaveBeenCalledWith("[sitemap] publish check failed", { slug: "down", error: "503" });
    log.mockRestore();
  });

  it("rejects non-http base URLs", () => {
    expect(publicSiteUrl(env({ PUBLIC_SITE_URL: "javascript:alert(1)" }))).toBeNull();
  });
});

describe("robots", () => {
  const ruleOf = (robots: ReturnType<typeof buildPublicRobots>) => (Array.isArray(robots.rules) ? robots.rules[0] : robots.rules);
  const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

  it("is deny-by-default with registry allows and a sitemap when PUBLIC_SITE_URL is set", () => {
    const robots = buildPublicRobots(env({ PUBLIC_SITE_URL: "https://s.example" }));
    const rule = ruleOf(robots);
    expect(list(rule?.disallow)).toEqual(expect.arrayContaining(["/", "/book/*/manage"]));
    expect(list(rule?.allow)).toEqual(ROBOTS_ALLOW.map((a) => a.prefix));
    expect(list(rule?.allow)).toEqual(expect.arrayContaining(["/site/", "/book/", "/pricing"]));
    expect(robots.sitemap).toBe("https://s.example/sitemap-index.xml");
  });

  it("disallows everything and omits the sitemap when PUBLIC_SITE_URL is unset (previews)", () => {
    const robots = buildPublicRobots(env({}));
    const rule = ruleOf(robots);
    expect(list(rule?.disallow)).toEqual(["/"]);
    expect(list(rule?.allow)).toEqual([]);
    expect(robots.sitemap).toBeUndefined();
    expect(robots.host).toBeUndefined();
  });

  it("keeps every signed-in route segment (app/(app), (auth), (mobile)) disallowed", () => {
    const appDir = join(dirname(fileURLToPath(import.meta.url)), "../../../app");
    const segments = ["(app)", "(auth)", "(mobile)"].flatMap((group) =>
      readdirSync(join(appDir, group), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => `/${d.name}`)
    );
    expect(segments).toEqual(expect.arrayContaining(["/dashboard", "/command-center", "/settings", "/login"]));
    const allows = list(ruleOf(buildPublicRobots(env({ PUBLIC_SITE_URL: "https://s.example" })))?.allow);
    for (const segment of segments) {
      // Covered by "Disallow: /" only if no allow prefix matches it.
      const allowed = allows.some((p) => (p.endsWith("$") ? segment === p.slice(0, -1) : `${segment}/`.startsWith(p) || segment.startsWith(p)));
      expect(allowed, segment).toBe(false);
    }
  });
});

describe("service x area sitemap entries", () => {
  const settings = {
    companyName: "Summit",
    offeredServices: [{ name: "AC Repair" }, { label: "Furnace Tune-Up" }, { name: "ac repair" }, { price: 5 }],
    serviceAreaZipCodes: ["78701", "78702", "78701", "bad"]
  };

  it("lists /site/:slug/:service/:area only for published opted-in shops, deduped, valid ZIPs only", async () => {
    const fetcher = vi.fn(async (slug: string) => (slug === "summit" ? settings : null));
    const map = await buildPublicSitemap(env({ PUBLIC_SITE_URL: "https://s.example", PUBLIC_SITE_SLUGS: "summit,draft" }), fetcher);
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

  it("robots explicitly allows the service-area route", () => {
    expect(ROBOTS_ALLOW.map((a) => a.prefix)).toContain("/site/*/*/");
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
    const e = env({ PUBLIC_SITE_URL: "https://s.example", PUBLIC_SITE_SLUGS: slugs.join(",") });
    const all = await buildFullSitemap(e, async () => settings);
    const perShop = serviceAreaSitemapPaths("shop-0", settings).length;
    expect(perShop).toBe(Math.min(4 * 125, MAX_SERVICE_AREA_URLS_PER_SHOP));
    expect(all.length).toBeGreaterThan(SITEMAP_URL_LIMIT);
    expect(all.length).toBe(MARKETING_SITEMAP_PATHS.length + 500 * (3 + perShop));

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
