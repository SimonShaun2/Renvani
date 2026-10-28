import { describe, expect, it, vi } from "vitest";

import { buildPublicRobots, buildPublicSitemap, optInSlugs, publicSiteUrl } from "./public-sitemap";

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

  it("drops unsafe slugs, dedupes, and treats fetch errors as unpublished", async () => {
    expect(optInSlugs(env({ PUBLIC_SITE_SLUGS: "a-1,A-1,../admin,,b%2f" }))).toEqual(["a-1"]);
    const map = await buildPublicSitemap(env({ PUBLIC_SITE_URL: "https://s.example", PUBLIC_SITE_SLUGS: "a-1" }), async () => {
      throw new Error("down");
    });
    expect(map).toEqual([]);
  });

  it("rejects non-http base URLs", () => {
    expect(publicSiteUrl(env({ PUBLIC_SITE_URL: "javascript:alert(1)" }))).toBeNull();
  });
});

describe("robots", () => {
  it("allows shop pages, blocks tokenized/app paths, links sitemap when configured", () => {
    const robots = buildPublicRobots(env({ PUBLIC_SITE_URL: "https://s.example" }));
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    expect(rule?.allow).toEqual(["/site/", "/book/"]);
    expect(rule?.disallow).toEqual(expect.arrayContaining(["/pay/", "/book/*/manage", "/api/"]));
    expect(robots.sitemap).toBe("https://s.example/sitemap.xml");
    expect(buildPublicRobots(env({})).sitemap).toBeUndefined();
  });
});
