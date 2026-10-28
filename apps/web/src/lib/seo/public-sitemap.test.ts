import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { ROBOTS_ALLOW, SitemapPublishCheckError, buildPublicRobots, buildPublicSitemap, optInSlugs, publicSiteUrl } from "./public-sitemap";

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
    expect(robots.sitemap).toBe("https://s.example/sitemap.xml");
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
